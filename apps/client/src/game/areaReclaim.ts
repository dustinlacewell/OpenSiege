import type { Feature } from "@mf/sim";
import { isScrap } from "./scrapPick.ts";

/** A right-drag area reclaim being drawn: a ground circle, and the wreck the press was on. */
export interface ReclaimArea {
  x: number;
  y: number;
  radius: number;
  /** The scrap under the press point. A drag too short to make a circle reclaims only this one. */
  press: number;
}

/** Pure. The scrap whose centre lies within `radius` of (x, y), in input order. */
export function scrapsInCircle(features: readonly Feature[], x: number, y: number, radius: number): Feature[] {
  const r2 = radius * radius;
  return features.filter((f) => isScrap(f) && (f.x - x) ** 2 + (f.y - y) ** 2 <= r2);
}

/**
 * Pure. At most `max` of `scraps` as a nearest-neighbour chain from (x, y):
 * each step goes to the nearest one left. A tie goes to the lower id.
 */
export function chainFrom(scraps: readonly Feature[], x: number, y: number, max: number): Feature[] {
  const left = [...scraps];
  const chain: Feature[] = [];
  let at = { x, y };
  while (left.length > 0 && chain.length < max) {
    const next = left.splice(nearestIndex(left, at.x, at.y), 1)[0]!;
    chain.push(next);
    at = next;
  }
  return chain;
}

/** Index of the feature nearest (x, y); the lower id on a tie. `fs` is not empty. */
function nearestIndex(fs: readonly Feature[], x: number, y: number): number {
  let best = 0;
  let bestD = Infinity;
  fs.forEach((f, i) => {
    const d = (f.x - x) ** 2 + (f.y - y) ** 2;
    if (d < bestD || (d === bestD && f.id < fs[best]!.id)) {
      best = i;
      bestD = d;
    }
  });
  return best;
}
