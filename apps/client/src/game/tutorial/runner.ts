// Walks a lesson step by step. Pure: every function returns a new state and leaves its inputs alone.
import type { Intent, World } from "@mf/sim";
import type { CameraPose, GuideView, Lesson, Step, Zone } from "./types.ts";

/**
 * `index` = current step; equals `steps.length` when the lesson is done. `sent` = intents since the step began.
 * `acknowledged` = the player pressed Continue on the current note.
 * `cameraStart` = the camera when the current step began; null until the first view.
 */
export interface TutorialState { index: number; sent: readonly Intent[]; acknowledged: boolean; cameraStart: CameraPose | null }

/** What the runner reads from the match each frame. */
export interface TutorialView { world: World; me: number; selected: readonly number[]; camera: CameraPose }

export function startTutorial(): TutorialState {
  return { index: 0, sent: [], acknowledged: false, cameraStart: null };
}

/** Records one intent the player sent. */
export function noteSent(state: TutorialState, intent: Intent): TutorialState {
  return { ...state, sent: [...state.sent, intent] };
}

/** Records Continue. Only a note step reads it. */
export function acknowledge(state: TutorialState): TutorialState {
  return state.acknowledged ? state : { ...state, acknowledged: true };
}

/**
 * Moves to the next step, `sent` and `acknowledged` cleared, when the current step is done. At most one step per call.
 * The first view sets `cameraStart`; a new step starts from the camera of the view that ended the last one.
 */
export function advance(lesson: Lesson, state: TutorialState, view: TutorialView): TutorialState {
  const started = state.cameraStart ? state : { ...state, cameraStart: view.camera };
  const step = currentStep(lesson, started);
  if (!step || !stepDone(step, started, view)) return started;
  return { index: started.index + 1, sent: [], acknowledged: false, cameraStart: view.camera };
}

/** A note is done once acknowledged; a task when its `done` holds. */
function stepDone(step: Step, state: TutorialState, view: TutorialView): boolean {
  return step.t === "note" ? state.acknowledged : step.done({ ...view, sent: state.sent, cameraStart: state.cameraStart ?? view.camera });
}

/** Time stops: a note shows, or a freeze task waits for its first intent. */
export function isPaused(lesson: Lesson, state: TutorialState): boolean {
  const step = currentStep(lesson, state);
  return step?.t === "note" || (step?.t === "task" && step.freeze === true && state.sent.length === 0);
}

export function finished(lesson: Lesson, state: TutorialState): boolean {
  return state.index >= lesson.steps.length;
}

/** The step in play, null when the lesson is done. */
export function currentStep(lesson: Lesson, state: TutorialState): Step | null {
  return lesson.steps[state.index] ?? null;
}

/** What the views show for the current step. Null when the lesson is done. Throws on an unknown zone name. */
export function guideView(lesson: Lesson, state: TutorialState, world: World, me: number): GuideView | null {
  const step = currentStep(lesson, state);
  if (!step) return null;
  return {
    prompt: step.prompt,
    index: state.index,
    count: lesson.steps.length,
    note: step.t === "note",
    controls: step.focus.controls,
    units: step.focus.units(world, me),
    zones: step.focus.zones.map((name) => zoneNamed(lesson, name)),
    gesture: step.focus.gesture?.(world, me) ?? null,
    follow: step.focus.follow?.(world, me) ?? [],
  };
}

function zoneNamed(lesson: Lesson, name: string): Zone {
  const zone = lesson.zones.find((z) => z.name === name);
  if (!zone) throw new Error(`tutorial: unknown zone "${name}"`);
  return zone;
}
