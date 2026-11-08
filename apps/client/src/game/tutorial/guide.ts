// The one seam input, HUD and renderer ask about the tutorial. A normal match uses NO_GUIDE.
import type { Intent } from "@mf/sim";
import { admit, allowedSelection, mayIssue } from "./policy.ts";
import {
  acknowledge, advance, currentStep, finished, guideView, isPaused, noteSent, startTutorial, type TutorialState, type TutorialView,
} from "./runner.ts";
import type { GuideView, Lesson } from "./types.ts";

/** What input, HUD and renderer ask. One implementation per match kind. */
export interface Guide {
  /** The intent to send, maybe with units taken out, or null to drop it. */
  admit(intent: Intent): Intent | null;
  mayIssue(t: Intent["t"]): boolean;
  selectable(ids: readonly number[]): number[];
  /** True while time stops: a note shows, or a step waits for the player's first order. */
  paused(): boolean;
  /** True while no click may change the selection (a note shows). */
  holdsSelection(): boolean;
  /** Continue: ends the current note. Nothing on any other step. */
  acknowledge(): void;
  /** Called once for every intent the player actually sent. */
  noteSent(intent: Intent): void;
  /** Called once per frame after the lockstep steps. */
  update(): void;
  view(): GuideView | null;
}

/** No tutorial: everything allowed, nothing shown, never paused. */
export const NO_GUIDE: Guide = {
  update: () => {},
  admit: (intent) => intent,
  mayIssue: () => true,
  selectable: (ids) => [...ids],
  paused: () => false,
  holdsSelection: () => false,
  acknowledge: () => {},
  noteSent: () => {},
  view: () => null,
};

/** One Guide handed out once at startup. It passes every call to the guide it holds. Starts as NO_GUIDE. */
export class GuideSlot implements Guide {
  private current: Guide = NO_GUIDE;

  /** Swaps the guide every holder of this slot now asks. */
  set(guide: Guide): void {
    this.current = guide;
  }

  admit(intent: Intent): Intent | null {
    return this.current.admit(intent);
  }

  mayIssue(t: Intent["t"]): boolean {
    return this.current.mayIssue(t);
  }

  selectable(ids: readonly number[]): number[] {
    return this.current.selectable(ids);
  }

  paused(): boolean {
    return this.current.paused();
  }

  holdsSelection(): boolean {
    return this.current.holdsSelection();
  }

  acknowledge(): void {
    this.current.acknowledge();
  }

  noteSent(intent: Intent): void {
    this.current.noteSent(intent);
  }

  update(): void {
    this.current.update();
  }

  view(): GuideView | null {
    return this.current.view();
  }
}

/**
 * Gates input by the current step of `lesson`. Free once the lesson is done.
 * `read` is null until the match has a world; until then a running lesson allows no intent and no selection.
 * A note step allows no intent and no selection, and pauses the match.
 */
export class TutorialGuide implements Guide {
  private state: TutorialState = startTutorial();
  private readonly lesson: Lesson;
  private readonly read: () => TutorialView | null;

  constructor(lesson: Lesson, read: () => TutorialView | null) {
    this.lesson = lesson;
    this.read = read;
  }

  /** Moves on when the current step is done. */
  update(): void {
    const view = this.read();
    if (view) this.state = advance(this.lesson, this.state, view);
  }

  /** The current step's index, null when the lesson is done. The scripted enemy reads it. */
  stepIndex(): number | null {
    return finished(this.lesson, this.state) ? null : this.state.index;
  }

  admit(intent: Intent): Intent | null {
    const step = currentStep(this.lesson, this.state);
    if (!step) return NO_GUIDE.admit(intent);
    const view = this.read();
    return step.t === "task" && view ? admit(step.policy, intent, view.world, view.me) : null;
  }

  mayIssue(t: Intent["t"]): boolean {
    const step = currentStep(this.lesson, this.state);
    if (!step) return NO_GUIDE.mayIssue(t);
    return step.t === "task" && mayIssue(step.policy, t);
  }

  selectable(ids: readonly number[]): number[] {
    const step = currentStep(this.lesson, this.state);
    if (!step) return NO_GUIDE.selectable(ids);
    const view = this.read();
    return step.t === "task" && view ? allowedSelection(step.policy, view.world, view.me, ids) : [];
  }

  paused(): boolean {
    return isPaused(this.lesson, this.state);
  }

  holdsSelection(): boolean {
    return currentStep(this.lesson, this.state)?.t === "note";
  }

  acknowledge(): void {
    if (this.holdsSelection()) this.state = acknowledge(this.state);
  }

  noteSent(intent: Intent): void {
    this.state = noteSent(this.state, intent);
  }

  view(): GuideView | null {
    const view = this.read();
    return view ? guideView(this.lesson, this.state, view.world, view.me) : null;
  }
}
