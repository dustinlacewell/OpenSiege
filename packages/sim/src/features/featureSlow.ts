import type { MoveClass } from "../stats.ts";
import { dist2 } from "../math.ts";
import type { Feature } from "../types.ts";
import type { FeatureIndex } from "./featureIndex.ts";
import { FEATURE_STATS } from "./featureStats.ts";

/**
 * Speed percent a unit of `cls` keeps with its centre at (x, y): the lowest `slowPercent` among the
 * features whose circle holds the point, 100 in the open. A feature the class crushes does not slow it.
 */
export function slowPercentAt(index: FeatureIndex, x: number, y: number, cls: MoveClass, near: Feature[]): number {
  let pct = 100;
  for (const f of index.query(x, y, 0, near)) {
    const s = FEATURE_STATS[f.kind];
    if (s.slowPercent >= pct || s.crushedBy.includes(cls)) continue;
    if (dist2(x, y, f.x, f.y) <= f.radius * f.radius) pct = s.slowPercent;
  }
  return pct;
}
