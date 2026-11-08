import { UNIT_STATS, type MoveClass } from "../stats.ts";
import { dist2 } from "../math.ts";
import { FEATURE_KINDS, FEATURE_STATS } from "../features/featureStats.ts";
import type { SimState } from "../simState.ts";
import type { Feature } from "../types.ts";

/** Move classes that crush some kind of feature. */
const CRUSHERS: ReadonlySet<MoveClass> = new Set(FEATURE_KINDS.flatMap((k) => FEATURE_STATS[k].crushedBy));

/**
 * A unit whose class crushes a kind of feature destroys each such feature its hull overlaps.
 * It only zeroes hp; `reap` removes the feature at the end of the tick. Runs after units moved.
 */
export function crush(state: SimState): void {
  const near: Feature[] = [];
  for (const u of state.world.units) {
    const s = UNIT_STATS[u.kind];
    if (u.hp <= 0 || !CRUSHERS.has(s.moveClass)) continue;
    for (const f of state.features.query(u.x, u.y, s.radius, near)) {
      if (!FEATURE_STATS[f.kind].crushedBy.includes(s.moveClass)) continue;
      const reach = s.radius + f.radius;
      if (dist2(u.x, u.y, f.x, f.y) < reach * reach) f.hp = 0;
    }
  }
}
