import { isSampled, type Cue, type SampledCue, type UiCue, type UiSounds, type Voice, type VoiceSink } from "./cues.ts";
import { loadMuted, saveMuted } from "./muteStore.ts";
import { jitterRate, playSample } from "./samplePlayer.ts";
import { SampleRenderer } from "./sampleRenderer.ts";
import type { SoundTuning } from "./soundTuning.ts";
import { makeEcho, makeNoise, type VoiceOut } from "./synthParts.ts";
import { SYNTHS } from "./synthVoices.ts";
import { Throttle } from "./throttle.ts";
import { admit, type Verdict } from "./voiceBudget.ts";

/** Why a voice did not play: the budget said no, or the renderer had too many sounds pending. */
export type DropReason = Exclude<Verdict, "play"> | "busy";

/** A snapshot of the voice budget, for the dev page. */
export interface EngineStats {
  total: number;
  byCue: Readonly<Partial<Record<Cue, number>>>;
  /** Voices dropped since the engine began, by reason. */
  dropped: Record<DropReason, number>;
}

interface Bus {
  ctx: AudioContext;
  master: GainNode;
  /** The shared outdoor echo. Voices send to it; it feeds the master. */
  echo: AudioNode;
  noise: AudioBuffer;
}

/** Schedules one voice on its output. Returns its length in seconds. */
type Sound = (v: VoiceOut) => number;

/**
 * The imperative shell: one AudioContext, a master gain with an outdoor echo, a gentle compressor and a limiter.
 * Nothing plays before `unlock` runs inside a user gesture; voices sent before that are dropped.
 * Weapon cues play a sample rendered fresh for each play, with its own seed; the rest are live synths.
 * The engine owns the current tuning; `setTuning` swaps it live.
 */
export class AudioEngine implements VoiceSink, UiSounds {
  private bus: Bus | null = null;
  private total = 0;
  private readonly byCue = new Map<Cue, number>();
  private readonly dropped: Record<DropReason, number> = { cueFull: 0, capFull: 0, reserved: 0, busy: 0 };
  private muted = loadMuted();
  private readonly uiThrottle = new Throttle((cue) => this.tuning.cues[cue].minGapSeconds);
  /** Renders the weapon sounds in a worker. Started now, before unlock; null where there are no workers. */
  private readonly renderer = typeof Worker === "undefined" ? null : new SampleRenderer();

  /** `random` (0..1) picks each weapon sound's seed and playback rate. */
  constructor(
    private current: SoundTuning,
    private readonly random: () => number = Math.random,
  ) {}

  /** The tuning in force. Others read it each time, so a swap reaches them. */
  get tuning(): SoundTuning {
    return this.current;
  }

  setTuning(t: SoundTuning): void {
    this.current = t;
    this.applyMasterGain();
  }

  stats(): EngineStats {
    return { total: this.total, byCue: Object.fromEntries(this.byCue), dropped: { ...this.dropped } };
  }

  /** Call from a user gesture. Creates the context once, resumes it after that. */
  unlock(): void {
    if (this.bus) {
      if (this.bus.ctx.state === "suspended") void this.bus.ctx.resume();
      return;
    }
    if (typeof AudioContext === "undefined") return;
    this.bus = createBus(new AudioContext(), this.muted ? 0 : this.current.global.masterGain);
    this.renderer?.setSampleRate(this.bus.ctx.sampleRate);
  }

  get running(): boolean {
    return this.bus?.ctx.state === "running";
  }

  get isMuted(): boolean {
    return this.muted;
  }

  toggleMute(): void {
    this.muted = !this.muted;
    saveMuted(this.muted);
    this.applyMasterGain();
  }

  /** Muted wins over the tuned master gain. */
  private applyMasterGain(): void {
    if (this.bus) this.bus.master.gain.setTargetAtTime(this.muted ? 0 : this.current.global.masterGain, this.bus.ctx.currentTime, 0.02);
  }

  ui(cue: UiCue): void {
    if (this.uiThrottle.allow(cue, performance.now() / 1000)) this.play({ cue, gain: 1, pan: 0, size: 0 });
  }

  play(voice: Voice): void {
    const bus = this.audible();
    if (!bus) return;
    const verdict = admit(voice.cue, this.current, { total: this.total, byCue: this.byCue });
    if (verdict !== "play") {
      this.dropped[verdict]++;
      return;
    }
    const cue = voice.cue;
    this.reserve(cue);
    if (isSampled(cue)) this.render(voice, cue);
    else this.schedule(bus, voice, (v) => SYNTHS[cue](v, voice.size));
  }

  /** The bus, when it can sound now: unlocked, running, not muted. */
  private audible(): Bus | null {
    const bus = this.bus;
    return bus && !this.muted && bus.ctx.state === "running" ? bus : null;
  }

  /** Asks for a fresh render of a weapon sound. Its slot is held already; a refused render frees it. */
  private render(voice: Voice, cue: SampledCue): void {
    const seed = Math.floor(this.random() * 2 ** 32);
    const asked = this.renderer?.render(cue, voice.size, seed, (samples, sr) => this.rendered(voice, samples, sr)) ?? false;
    if (asked) return;
    this.release(cue);
    this.dropped.busy++;
  }

  /** Plays a finished render, unless the engine went quiet while it rendered. */
  private rendered(voice: Voice, samples: Float32Array<ArrayBuffer>, sr: number): void {
    const bus = this.audible();
    if (!bus) {
      this.release(voice.cue);
      return;
    }
    const buffer = bus.ctx.createBuffer(1, samples.length, sr);
    buffer.copyToChannel(samples, 0);
    const rate = jitterRate(this.random);
    this.schedule(bus, voice, (v) => playSample(v, buffer, rate));
  }

  private reserve(cue: Cue): void {
    this.total++;
    this.byCue.set(cue, (this.byCue.get(cue) ?? 0) + 1);
  }

  private release(cue: Cue): void {
    this.total--;
    this.byCue.set(cue, (this.byCue.get(cue) ?? 1) - 1);
  }

  /** Plays a sound through its own gain, panner and echo send. Frees its slot after its length plus 0.1 s. */
  private schedule(bus: Bus, voice: Voice, sound: Sound): void {
    const { ctx } = bus;
    const panner = ctx.createStereoPanner();
    const gain = ctx.createGain();
    const echo = ctx.createGain();
    const level = voice.gain * this.current.cues[voice.cue].baseGain;
    panner.pan.value = voice.pan;
    gain.gain.value = level;
    echo.gain.value = level;
    gain.connect(panner).connect(bus.master);
    echo.connect(bus.echo);
    const length = sound({ ctx, out: gain, echo, noise: bus.noise, t: ctx.currentTime });
    setTimeout(() => {
      this.release(voice.cue);
      panner.disconnect();
      echo.disconnect();
    }, length * 1000 + 100);
  }
}

/** Master gain (with the echo fed in) into a soft compressor, then a hard limiter, into the speakers. */
function createBus(ctx: AudioContext, masterGain: number): Bus {
  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = -3;
  limiter.knee.value = 0;
  limiter.ratio.value = 20;
  limiter.attack.value = 0.001;
  limiter.release.value = 0.1;
  limiter.connect(ctx.destination);
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -18;
  comp.knee.value = 12;
  comp.ratio.value = 3;
  comp.attack.value = 0.005;
  comp.release.value = 0.2;
  comp.connect(limiter);
  const master = ctx.createGain();
  master.gain.value = masterGain;
  master.connect(comp);
  const echo = ctx.createConvolver();
  echo.buffer = makeEcho(ctx);
  echo.connect(master);
  return { ctx, master, echo, noise: makeNoise(ctx) };
}
