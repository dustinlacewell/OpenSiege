import type { Unit } from "@mf/sim";
import type { Point } from "../geometry.ts";
import type { Task } from "../tasks.ts";

/** Ticks a stay-or-go choice holds before it may flip back. Deploy and pack take time; flip-flop wastes it. */
const HOLD = 80;

export interface Choice {
  stay: boolean;
  since: number;
}

/**
 * A siege unit that follows an anchor point: deployed where it stands (`stay`), or driving to the anchor.
 * A flip is held back until the last one is `HOLD` ticks old.
 */
export function follow(anchor: Point, wantStay: boolean, prev: Choice | undefined, tick: number): { task: Task; choice: Choice } {
  const stay = prev && prev.stay !== wantStay && tick - prev.since < HOLD ? prev.stay : wantStay;
  const choice = prev && prev.stay === stay ? prev : { stay, since: tick };
  const task: Task = stay ? { t: "siege", on: true } : { t: "goto", ...anchor, attack: false, siege: false };
  return { task, choice };
}

/** True for a unit that is deployed or deploying. */
export function anchored(u: Readonly<Unit>): boolean {
  return u.mode === "sieged" || u.mode === "deploying";
}
