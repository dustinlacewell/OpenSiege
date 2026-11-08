import type { AudioEngine } from "../../audio/audioEngine.ts";
import { mixEvents } from "../../audio/mixer.ts";
import { CUES, type SoundTuning } from "../../audio/soundTuning.ts";
import { Throttle } from "../../audio/throttle.ts";
import { setText } from "../../ui/dom.ts";
import { button, el } from "../build.ts";
import type { Table } from "../tableEditor/schema.ts";
import {
  DEFAULT_CAMERA_DIST, NO_DROPS, bucketByStep, cameraRange, draftToTuning, listenerAt, readout, scenarios, singleSound,
  type Drops, type ScheduledSound, type Step,
} from "./auditionModel.ts";

// The audition panel: plays the real engine and mixer with the draft tuning. The scheduling and the DOM are here;
// what is played and what is shown is in `auditionModel.ts`.

/** Stress events land within this share of the hearing radius, so all of them can be heard. */
const REACH_SHARE = 0.5;
const REFRESH_MS = 250;
/** No fog of war here: every point is heard. */
const HEAR_ALL = (): boolean => true;

export interface AuditionPanel {
  /** The draft changed. A draft with a bad cell keeps the last good tuning in the engine. */
  setDraft(draft: Table): void;
}

export function mountAudition(root: HTMLElement, engine: AudioEngine): AuditionPanel {
  return new AuditionView(root, engine);
}

class AuditionView implements AuditionPanel {
  private last: SoundTuning;
  private baseline: Drops = NO_DROPS;
  /** What the user picked. The slider shows it clamped to the tuning's zoom range, and it returns when the range allows. */
  private chosenDist = DEFAULT_CAMERA_DIST;
  private readonly timers = new Set<number>();
  private readonly throttle: Throttle;
  private readonly camera = el("input");
  private readonly cameraValue = el("span", "aud-value");
  private readonly playing = el("span", "aud-value");
  private readonly active = el("div", "aud-active");
  private readonly drops: Record<keyof Drops, HTMLElement> = { cueFull: el("span", "aud-value"), capFull: el("span", "aud-value"), reserved: el("span", "aud-value"), busy: el("span", "aud-value") };

  constructor(root: HTMLElement, private readonly engine: AudioEngine) {
    this.last = engine.tuning;
    // As WorldSounds does: the gap is read from the tuning in force on every call.
    this.throttle = new Throttle((cue) => engine.tuning.cues[cue].minGapSeconds);
    root.append(this.cueGroup(), this.stressGroup(), this.mixGroup(), this.liveGroup());
    this.syncCamera();
    window.setInterval(() => this.refresh(), REFRESH_MS);
  }

  setDraft(draft: Table): void {
    this.last = draftToTuning(draft, this.last);
    this.engine.setTuning(this.last);
    this.syncCamera();
  }

  private cueGroup(): HTMLElement {
    const group = this.group("Cues");
    const row = el("div", "aud-row");
    for (const cue of CUES) row.append(button(cue, "", () => this.run([singleSound(cue)])));
    group.append(row);
    return group;
  }

  private stressGroup(): HTMLElement {
    const group = this.group("Stress");
    const row = el("div", "aud-row");
    scenarios(0).forEach((s, i) => row.append(button(s.label, "", () => this.run(scenarios(this.reach())[i]!.sounds))));
    row.append(button("Stop", "", () => this.stop()));
    group.append(row);
    return group;
  }

  private mixGroup(): HTMLElement {
    const group = this.group("Mix");
    const mute = el("input");
    mute.type = "checkbox";
    mute.checked = this.engine.isMuted;
    mute.addEventListener("change", () => this.engine.toggleMute());
    const muteLabel = el("label", "aud-field");
    muteLabel.append(mute, " Mute");
    this.camera.type = "range";
    this.camera.addEventListener("input", () => {
      this.chosenDist = Number(this.camera.value);
      this.showCamera();
    });
    const cameraLabel = el("label", "aud-field");
    cameraLabel.append("Camera distance", this.camera, this.cameraValue);
    group.append(muteLabel, cameraLabel);
    return group;
  }

  private liveGroup(): HTMLElement {
    const group = this.group("Live");
    const row = el("div", "aud-row");
    row.append(this.stat("Playing", this.playing), this.stat("Cue full", this.drops.cueFull), this.stat("Cap full", this.drops.capFull), this.stat("Reserved", this.drops.reserved), this.stat("Renderer busy", this.drops.busy));
    row.append(button("Reset", "", () => (this.baseline = this.engine.stats().dropped)));
    group.append(row, this.active);
    return group;
  }

  private group(title: string): HTMLElement {
    const group = el("section", "aud-group");
    group.append(el("h2", "", title));
    return group;
  }

  private stat(label: string, value: HTMLElement): HTMLElement {
    const stat = el("span", "aud-stat");
    stat.append(label, " ", value);
    return stat;
  }

  /** The slider spans the tuning's zoom range. The browser keeps the value inside it. */
  private syncCamera(): void {
    const { min, max } = cameraRange(this.engine.tuning.global);
    this.camera.min = String(min);
    this.camera.max = String(max);
    this.camera.step = "100";
    this.camera.value = String(this.chosenDist);
    this.showCamera();
  }

  private showCamera(): void {
    setText(this.cameraValue, this.camera.value);
  }

  private cameraDist(): number {
    return Number(this.camera.value);
  }

  private reach(): number {
    return listenerAt(this.cameraDist(), this.engine.tuning.global).radius * REACH_SHARE;
  }

  private run(sounds: readonly ScheduledSound[]): void {
    this.engine.unlock();
    for (const step of bucketByStep(sounds)) {
      const id = window.setTimeout(() => {
        this.timers.delete(id);
        this.playStep(step);
      }, step.atMs);
      this.timers.add(id);
    }
  }

  private stop(): void {
    for (const id of this.timers) window.clearTimeout(id);
    this.timers.clear();
  }

  /** As WorldSounds does for one step: mix the events, hold back what the throttle says, play the rest. */
  private playStep(step: Step): void {
    const g = this.engine.tuning.global;
    const now = performance.now() / 1000;
    for (const v of mixEvents(step.events, listenerAt(this.cameraDist(), g), HEAR_ALL, g)) {
      if (this.throttle.allow(v.cue, now)) this.engine.play(v);
    }
    for (const cue of step.ui) this.engine.ui(cue);
  }

  private refresh(): void {
    const r = readout(this.engine.stats(), this.baseline, this.engine.tuning.global.voiceCap);
    setText(this.playing, `${r.playing} / ${r.cap}`);
    for (const key of Object.keys(this.drops) as (keyof Drops)[]) setText(this.drops[key], String(r.drops[key]));
    setText(this.active, r.active.map((a) => `${a.cue} ${a.count}`).join("   "));
  }
}
