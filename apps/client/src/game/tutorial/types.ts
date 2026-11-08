// Plain data for lessons: steps, what each step allows, what it points at, and when it is done. No logic.
import type { Intent, Unit, UnitKind, World } from "@mf/sim";

/** A named circle on the map that a lesson can point at. World units. */
export interface Zone { name: string; x: number; y: number; radius: number }

/** Where the camera looks: the ground point and the turn in radians. */
export interface CameraPose { x: number; y: number; yaw: number }

/**
 * What a goal may look at. `sent` = intents the player sent since the current step began, in order.
 * `cameraStart` = the camera when the current step began.
 */
export interface Observation {
  world: World; me: number; selected: readonly number[]; sent: readonly Intent[]; camera: CameraPose; cameraStart: CameraPose;
}

/** One allowed command. `where` narrows it; absent = any intent of that tag. Build one with `rule`. */
export interface IntentRule {
  t: Intent["t"];
  where?: (intent: Intent, world: World, me: number) => boolean;
}

/**
 * What the player may do in a step. Camera is never restricted.
 * `commandable` = the units a unit order (move, attack-move, guard, stop) may name; the guide takes the others out first.
 */
export interface Policy {
  intents: readonly IntentRule[];
  selectable: (unit: Unit, me: number) => boolean;
  commandable: (unit: Unit, me: number) => boolean;
}

/** A HUD control a step can point at. */
export type ControlId = { t: "slot"; kind: UnitKind } | { t: "cmd"; name: "siege" | "stop" | "guard" | "attack" };

/**
 * A right-drag the renderer acts out on the ground, `from` to `to`, on a loop. World units.
 * `line`: a curve move, the units spread along it. `circle`: an area reclaim, centred on `from`, its edge at `to`.
 */
export interface Gesture { shape: "line" | "circle"; from: { x: number; y: number }; to: { x: number; y: number } }

/**
 * What a step highlights. `gesture` = a drag to act out, from the world as it is; null for none.
 * `follow` = units the camera tracks while the list is not empty.
 */
export interface Focus {
  controls: readonly ControlId[];
  units: (world: World, me: number) => readonly number[];
  zones: readonly string[];
  gesture?: (world: World, me: number) => Gesture | null;
  follow?: (world: World, me: number) => readonly number[];
}

/** What the scripted enemy (player `enemy`) sends once, when a step starts. */
export type EnemyScript = (world: World, enemy: number) => Intent[];

/**
 * The player does something. Ends when `done` holds. `freeze`: time stops until the player sends the step's first intent.
 * A freeze step that allows no intent stays stopped until `done`, as for a camera lesson.
 */
export interface TaskStep {
  t: "task"; id: string; prompt: string; policy: Policy; focus: Focus; done: (obs: Observation) => boolean;
  enemy?: EnemyScript; freeze?: boolean;
}

/** An explanation. Time stops, no intent passes and the selection holds while it shows. Ends on Continue. */
export interface NoteStep { t: "note"; id: string; prompt: string; focus: Focus; enemy?: EnemyScript }

export type Step = TaskStep | NoteStep;

export interface Lesson { zones: readonly Zone[]; steps: readonly Step[] }

/** Plain data for views (HUD, renderer). Zones resolved by name. */
export interface GuideView {
  prompt: string;
  index: number;
  count: number;
  /** A note step: the HUD shows Continue and locks every control. */
  note: boolean;
  controls: readonly ControlId[];
  units: readonly number[];
  zones: readonly Zone[];
  gesture: Gesture | null;
  /** Units the camera tracks. Empty: no tracking. */
  follow: readonly number[];
}

/** A rule for tag `t`. `where` gets the intent already narrowed to that tag; another tag never matches. */
export function rule<K extends Intent["t"]>(
  t: K,
  where?: (intent: Extract<Intent, { t: K }>, world: World, me: number) => boolean,
): IntentRule {
  if (!where) return { t };
  return { t, where: (intent, world, me) => intent.t === t && where(intent as Extract<Intent, { t: K }>, world, me) };
}
