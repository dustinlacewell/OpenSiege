import type { EngineStats } from "../../audio/audioEngine.ts";
import type { Cue, SoundEvent, UiCue } from "../../audio/cues.ts";
import { listenerOf, type Listener } from "../../audio/mixer.ts";
import { CUES, type GlobalTuning, type SoundTuning } from "../../audio/soundTuning.ts";
import { createCamera } from "../../game/camera.ts";
import type { Table } from "../tableEditor/schema.ts";
import { tableToTuning } from "./soundTable.ts";

// What the audition panel plays and shows. Pure: no DOM, no Web Audio, no clock. The view schedules and plays.

/** One sound at a time offset. A world event goes through the mixer; an interface sound goes to `engine.ui`. */
export type ScheduledSound = { atMs: number; event: SoundEvent } | { atMs: number; ui: UiCue };

export interface Scenario {
  id: string;
  label: string;
  sounds: ScheduledSound[];
}

/** The sounds that arrive in one step, as the game's world update would hand them to the mixer. */
export interface Step {
  atMs: number;
  events: SoundEvent[];
  ui: UiCue[];
}

/** The world is mixed once per step; one `mixEvents` call per bucket. */
export const STEP_MS = 50;
export const DEFAULT_CAMERA_DIST = 3000;

/** The interface cues. The rest are world cues. */
const UI_CUES: readonly UiCue[] = ["ack", "queued", "refused", "select"];
/** The world cues that play centred, wherever the camera is (`worldEvents.ts`). */
const CENTRED: readonly Cue[] = ["underAttack", "built", "credits"];

/** The last tuning whose draft was legal. A draft with any bad cell keeps `last`, so the engine never gets a broken tuning. */
export function draftToTuning(draft: Table, last: SoundTuning): SoundTuning {
  const parsed = tableToTuning(draft);
  return parsed.ok ? parsed.tuning : last;
}

/** The camera distances the slider offers: where the zoom factor starts to fall to where it stops. */
export function cameraRange(g: GlobalTuning): { min: number; max: number } {
  return { min: g.zoomNear, max: g.zoomFar };
}

/** The listener for a camera `dist` away, looking at the origin. */
export function listenerAt(dist: number, g: GlobalTuning): Listener {
  const cam = createCamera(800, 600);
  cam.dist = dist;
  return listenerOf(cam, g);
}

/** One cue, once, at the listener's feet. */
export function singleSound(cue: Cue): ScheduledSound {
  const ui = UI_CUES.find((c) => c === cue);
  if (ui) return { atMs: 0, ui };
  return { atMs: 0, event: { cue: cue as SoundEvent["cue"], x: 0, y: 0, spatial: !CENTRED.includes(cue), own: true, size: 0.5 } };
}

/**
 * The stress scenarios. `reach` is the ground distance that placed events spread over, from the listener: pass less than the
 * hearing radius so every one can be heard. Each list is in time order.
 */
export function scenarios(reach: number): Scenario[] {
  const placed = (cue: SoundEvent["cue"], n: number, spanMs: number, offset = 0) =>
    Array.from({ length: n }, (_, i) => shotAt(cue, i, n, reach, Math.floor((i * spanMs) / n) + offset));
  return [
    { id: "shots", label: "50 shots in 1 s", sounds: byTime(placed("shotDirect", 50, 1000)) },
    {
      id: "order",
      label: "30-unit order",
      sounds: Array.from({ length: 30 }, (_, i): ScheduledSound => ({ atMs: Math.floor((i * 300) / 30), ui: "ack" })),
    },
    {
      id: "fight",
      label: "big fight",
      sounds: byTime([
        ...placed("shotBallistic", 20, 4000),
        ...placed("shotBallistic", 20, 7000),
        ...placed("shotDirect", 20, 5000),
        ...placed("shellGround", 10, 3000),
        ...placed("shellArmor", 10, 8000),
        ...placed("shellGround", 10, 5000),
        ...placed("shellArmor", 10, 10000),
        ...placed("roundGround", 10, 4000),
        ...placed("roundArmor", 10, 6000),
        ...placed("shellGround", 10, 7000),
        ...placed("shellArmor", 10, 9000),
        ...placed("destroyed", 10, 5000),
        ...placed("destroyed", 5, 10000),
        ...placed("destroyed", 10, 3000),
        ...placed("destroyed", 5, 8000),
        alert(1500)
      ]),
    },
    { id: "alert", label: "alert under load", sounds: byTime([...placed("shotDirect", 200, 1000), alert(500)]) },
  ];
}

/** Groups sounds by step: one bucket per `stepMs` window that holds any, in time order. `atMs` is the window's start. */
export function bucketByStep(sounds: readonly ScheduledSound[], stepMs: number = STEP_MS): Step[] {
  const steps = new Map<number, Step>();
  for (const s of byTime(sounds)) {
    const atMs = Math.floor(s.atMs / stepMs) * stepMs;
    const step = steps.get(atMs) ?? { atMs, events: [], ui: [] };
    if ("event" in s) step.events.push(s.event);
    else step.ui.push(s.ui);
    steps.set(atMs, step);
  }
  return [...steps.values()];
}

export type Drops = EngineStats["dropped"];

/** What the live panel shows. */
export interface Readout {
  playing: number;
  cap: number;
  /** Cues with a voice playing now, in cue order. */
  active: { cue: Cue; count: number }[];
  /** Drops since `baseline`. */
  drops: Drops;
}

export const NO_DROPS: Drops = { cueFull: 0, capFull: 0, reserved: 0, busy: 0 };

export function readout(stats: EngineStats, baseline: Drops, voiceCap: number): Readout {
  return {
    playing: stats.total,
    cap: voiceCap,
    active: CUES.flatMap((cue) => ((stats.byCue[cue] ?? 0) > 0 ? [{ cue, count: stats.byCue[cue]! }] : [])),
    drops: {
      cueFull: stats.dropped.cueFull - baseline.cueFull,
      capFull: stats.dropped.capFull - baseline.capFull,
      reserved: stats.dropped.reserved - baseline.reserved,
      busy: stats.dropped.busy - baseline.busy,
    },
  };
}

/** The i-th of n events on a spiral around the listener, out to `reach`: spread, not stacked. */
function shotAt(cue: SoundEvent["cue"], i: number, n: number, reach: number, atMs: number): ScheduledSound {
  const angle = i * GOLDEN_ANGLE;
  const r = reach * Math.sqrt((i + 0.5) / n);
  return { atMs, event: { cue, x: Math.cos(angle) * r, y: Math.sin(angle) * r, spatial: true, own: true, size: 0.5 } };
}

const GOLDEN_ANGLE = 2.399963229728653;

function alert(atMs: number): ScheduledSound {
  return { atMs, event: { cue: "underAttack", x: 0, y: 0, spatial: false, own: true, size: 1 } };
}

/** Stable: sounds with the same time keep their order. */
function byTime(sounds: readonly ScheduledSound[]): ScheduledSound[] {
  return [...sounds].sort((a, b) => a.atMs - b.atMs);
}
