import { UNIT_STATS } from "./stats.ts";
import type { Unit } from "./types.ts";

/** Sieged or deploying: the unit holds its ground. */
export function isAnchored(u: Unit): boolean {
  return u.mode === "sieged" || u.mode === "deploying";
}

/** mobile → deploying. Kinds with no siege time stay mobile. */
export function startDeploying(u: Unit): void {
  const ticks = UNIT_STATS[u.kind].siegeTicks;
  if (u.mode !== "mobile" || ticks <= 0) return;
  u.mode = "deploying";
  u.modeTimer = ticks;
}

export function startPacking(u: Unit): void {
  u.mode = "packing";
  u.modeTimer = UNIT_STATS[u.kind].siegeTicks;
}
