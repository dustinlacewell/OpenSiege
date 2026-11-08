import { PROJ_FP } from "../stats.ts";
import { dist2 } from "../math.ts";
import { heightAt } from "../terrain.ts";
import type { Feature, Terrain } from "../types.ts";
import type { FeatureIndex } from "./featureIndex.ts";
import { FEATURE_STATS, isDestroyed } from "./featureStats.ts";

/** A shell position, fixed-point (1/PROJ_FP world unit). */
export interface Fp3 { x: number; y: number; z: number }

/**
 * The first feature (index order) a shell enters on its straight move from `prev` to `cur`, or null.
 * It enters a shot-blocking feature when `prev` is outside the circle, the segment comes within its radius,
 * and the shell is no higher than the feature top at the closest point. A shell that starts inside
 * (a unit beside a rock) is left alone. Integer math only.
 */
export function featureHit(index: FeatureIndex, terrain: Terrain, prev: Fp3, cur: Fp3, near: Feature[]): Feature | null {
  const dx = cur.x - prev.x, dy = cur.y - prev.y;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return null;
  const reach = Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / PROJ_FP);
  for (const f of index.query(Math.floor(cur.x / PROJ_FP), Math.floor(cur.y / PROJ_FP), reach, near)) {
    const s = FEATURE_STATS[f.kind];
    if (!s.blocksShot || isDestroyed(f)) continue;
    const cx = f.x * PROJ_FP, cy = f.y * PROJ_FP, r = f.radius * PROJ_FP;
    if (dist2(prev.x, prev.y, cx, cy) <= r * r) continue;
    const along = (cx - prev.x) * dx + (cy - prev.y) * dy;
    if (along <= 0) continue;
    const t = Math.min(along, len2);
    const px = prev.x + Math.trunc((dx * t) / len2), py = prev.y + Math.trunc((dy * t) / len2);
    if (dist2(px, py, cx, cy) > r * r) continue;
    const pz = prev.z + Math.trunc(((cur.z - prev.z) * t) / len2);
    if (pz <= (heightAt(terrain, f.x, f.y) + s.height) * PROJ_FP) return f;
  }
  return null;
}
