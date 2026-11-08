import { UNIT_STATS } from "./stats.ts";
import { workRateOf } from "./units.ts";
import type { Unit } from "./types.ts";

/** A factory engineer `e` may speed up: same owner, alive, a job in its queue, and not deploying or packing. */
export function isBoostable(e: Unit, t: Unit): boolean {
  return t.kind === "factory" && t.owner === e.owner && t.hp > 0 && t.queue.length > 0 && workRateOf(t) > 0;
}

/** A unit engineer `e` may heal: not itself, same owner, alive, and hurt. */
export function isPatient(e: Unit, t: Unit): boolean {
  return t !== e && t.owner === e.owner && t.hp > 0 && t.hp < UNIT_STATS[t.kind].maxHp;
}
