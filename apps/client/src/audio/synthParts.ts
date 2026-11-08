/** Where a voice plays: the context, its output node, the send to the outdoor echo, the shared noise, and the start time. */
export interface VoiceOut {
  ctx: AudioContext;
  out: AudioNode;
  /** The echo send. It already carries the voice gain. Use `echoed` to feed it. */
  echo: AudioNode;
  noise: AudioBuffer;
  t: number;
}

/** One second of white noise. Made once, shared by every noise burst. */
export function makeNoise(ctx: AudioContext): AudioBuffer {
  const buf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return buf;
}

const ECHO_SECONDS = 1.2;
/** Silence before the first echo, in seconds. */
const ECHO_DELAY = 0.025;

/**
 * The impulse of an open field: 1.2 seconds of decaying stereo noise. Made once.
 * It starts bright and turns dark as it fades, like sound that rolls back from far hills.
 */
export function makeEcho(ctx: AudioContext): AudioBuffer {
  const len = Math.floor(ctx.sampleRate * ECHO_SECONDS);
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const data = buf.getChannelData(ch);
    let low = 0;
    for (let i = Math.floor(ctx.sampleRate * ECHO_DELAY); i < len; i++) {
      const at = i / ctx.sampleRate;
      const a = 0.6 * Math.exp(-4 * at) + 0.03;
      low += a * (Math.random() * 2 - 1 - low);
      // The one-pole filter loses level as it darkens; the root puts it back.
      data[i] = low * Math.sqrt((2 - a) / a) * Math.exp(-6 * at);
    }
  }
  return buf;
}

/** How hard `saturate` drives. Small signals pass at full level; loud ones round off near 1/DRIVE. */
const DRIVE = 2;
const SOFT_CLIP = softClipCurve(1025);

function softClipCurve(n: number): Float32Array<ArrayBuffer> {
  const curve = new Float32Array(n);
  for (let i = 0; i < n; i++) curve[i] = Math.tanh(DRIVE * ((2 * i) / (n - 1) - 1)) / DRIVE;
  return curve;
}

/**
 * The same output through a soft clipper. Low booms gain overtones, so phone speakers
 * that cannot play deep bass still carry them. Loud peaks round off instead of cracking.
 */
export function saturate(v: VoiceOut): VoiceOut {
  const shaper = v.ctx.createWaveShaper();
  shaper.curve = SOFT_CLIP;
  shaper.oversample = "4x";
  shaper.connect(v.out);
  return { ...v, out: shaper };
}

/** The same output, with `amount` of it also sent to the outdoor echo. */
export function echoed(v: VoiceOut, amount: number): VoiceOut {
  const send = v.ctx.createGain();
  send.gain.value = amount;
  send.connect(v.echo);
  const split = v.ctx.createGain();
  split.connect(v.out);
  split.connect(send);
  return { ...v, out: split };
}

/** A gain node with a fast attack and an exponential decay to silence. */
function envelope(v: VoiceOut, start: number, peak: number, decay: number): GainNode {
  const g = v.ctx.createGain();
  const t = v.t + start;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
  g.connect(v.out);
  return g;
}

/** An oscillator that sweeps from `f0` to `f1` Hz over `decay` seconds. Returns its end time from `v.t`. */
export function tone(v: VoiceOut, type: OscillatorType, f0: number, f1: number, peak: number, decay: number, start = 0): number {
  const osc = v.ctx.createOscillator();
  const t = v.t + start;
  osc.type = type;
  osc.frequency.setValueAtTime(f0, t);
  osc.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + decay);
  osc.connect(envelope(v, start, peak, decay));
  osc.start(t);
  osc.stop(t + decay + 0.02);
  return start + decay;
}

/**
 * Shortest step and random spread of the level wobble in `rumble`, in seconds.
 * Slow steps make swells. Fast steps (under 0.1 s) make a buzz, like loose sheet metal.
 */
const ROLL_STEP = 0.12;
const ROLL_SPREAD = 0.16;

const rollStep = () => ROLL_STEP + ROLL_SPREAD * Math.random();

/**
 * Low rolling noise, like far-off thunder. The cutoff falls from `f0` to `f1` Hz over `decay` seconds.
 * Two flat low-pass filters (no ringing). The level rises over `attack`, then dies away while it swells
 * at random: `roll` 0 is smooth, 1 is very uneven. Returns its end time from `v.t`.
 */
export function rumble(v: VoiceOut, f0: number, f1: number, peak: number, decay: number, start = 0, attack = 0.03, roll = 0.5): number {
  const src = v.ctx.createBufferSource();
  const t = v.t + start;
  src.buffer = v.noise;
  src.loop = true;
  const g = v.ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(peak, t + attack);
  for (let at = attack + rollStep(); at < decay; at += rollStep()) {
    const fall = Math.exp((-5 * at) / decay);
    g.gain.linearRampToValueAtTime(peak * fall * (1 - roll + roll * 1.6 * Math.random()), t + at);
  }
  g.gain.linearRampToValueAtTime(0, t + decay);
  g.connect(v.out);
  let node: AudioNode = src;
  for (let i = 0; i < 2; i++) {
    const f = v.ctx.createBiquadFilter();
    f.type = "lowpass";
    f.Q.value = 0.5;
    f.frequency.setValueAtTime(f0, t);
    f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + decay);
    node.connect(f);
    node = f;
  }
  node.connect(g);
  src.start(t, Math.random() * 0.5);
  src.stop(t + decay + 0.02);
  return start + decay;
}

/** Filtered noise with a decay. Returns its end time from `v.t`. */
export function noise(v: VoiceOut, filter: BiquadFilterType, freq: number, peak: number, decay: number, start = 0): number {
  const src = v.ctx.createBufferSource();
  const f = v.ctx.createBiquadFilter();
  const t = v.t + start;
  src.buffer = v.noise;
  src.loop = true;
  f.type = filter;
  f.frequency.value = freq;
  src.connect(f).connect(envelope(v, start, peak, decay));
  src.start(t, Math.random() * 0.5);
  src.stop(t + decay + 0.02);
  return start + decay;
}
