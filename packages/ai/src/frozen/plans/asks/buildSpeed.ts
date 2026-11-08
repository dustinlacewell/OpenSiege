import { UNIT_STATS, workRateOf, type ResourceField, type Unit } from "@mf/sim";
import { within } from "../../geometry.ts";
import type { Picture } from "../../perception/picture.ts";

/** Build work a sieged engineer adds to a factory in reach, per tick (`sim/systems/repair.md`). */
export const ENGINEER_BOOST = 2;
/** A sieged engineer boosts a factory this close: the sim's engineer work range. The support plan stands engineers inside it. */
export const ENGINEER_REACH = UNIT_STATS.engineer.workRange;

/** Credits per tick: each harvester inside a field earns its work rate, 5 sieged and 1 mobile. */
export function income(pic: Picture): number {
  let s = 0;
  for (const h of pic.mine.harvester) if (inField(h, pic.fields)) s += workRateOf(h);
  return s;
}

/** Build work per tick: each factory's work rate (4 sieged, 1 mobile), plus the sieged engineers in reach of a factory. */
export function buildSpeed(pic: Picture): number {
  let s = 0;
  for (const f of pic.mine.factory) s += workRateOf(f);
  for (const e of pic.mine.engineer) {
    if (e.mode === "sieged" && pic.mine.factory.some((f) => within(e, f, ENGINEER_REACH))) s += ENGINEER_BOOST;
  }
  return s;
}

function inField(u: Readonly<Unit>, fields: readonly Readonly<ResourceField>[]): boolean {
  return fields.some((f) => within(u, f, f.radius));
}
