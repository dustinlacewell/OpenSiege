import { dist2 } from "./math.ts";
import { head } from "./orders.ts";
import { workReachOf } from "./units.ts";
import { findFeature } from "./features/findFeature.ts";
import { reclaimable } from "./features/reclaim.ts";
import type { Feature, Order, Unit, World } from "./types.ts";

export type ReclaimOrder = Extract<Order, { type: "reclaim" }>;

/** The reclaimable scrap `u`'s head reclaim order names, or undefined. */
export function reclaimTarget(world: World, u: Unit): Feature | undefined {
  const o = head(u);
  if (o?.type !== "reclaim") return undefined;
  const f = findFeature(world, o.target);
  return reclaimable(f) ? f : undefined;
}

/** True when the gap from `e`'s centre to the edge of `f` is within `e`'s work reach (`workReachOf`). */
export function inReclaimReach(e: Unit, f: Feature): boolean {
  const r = workReachOf(e) + f.radius;
  return dist2(e.x, e.y, f.x, f.y) <= r * r;
}
