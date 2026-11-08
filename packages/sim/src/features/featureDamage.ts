import { dist2, isqrt } from "../math.ts";
import type { Feature } from "../types.ts";
import type { FeatureIndex } from "./featureIndex.ts";
import { FEATURE_STATS } from "./featureStats.ts";

/** Take damage. A feature that cannot be destroyed (maxHp 0) takes none. `reap` removes it at 0 hp. */
export function damageFeature(f: Feature, amount: number): void {
  if (FEATURE_STATS[f.kind].maxHp > 0) f.hp -= amount;
}

/**
 * Linear splash from (x, y) on every feature, measured to its edge, like units. `except` took the direct hit.
 * Friendly fire does not apply: features have no owner.
 */
export function splashFeatures(index: FeatureIndex, x: number, y: number, damage: number, splash: number, except: Feature | null): void {
  for (const f of index.query(x, y, splash, [])) {
    if (f === except) continue;
    const d = Math.max(0, isqrt(dist2(x, y, f.x, f.y)) - f.radius);
    if (d < splash) damageFeature(f, Math.floor((damage * (splash - d)) / splash));
  }
}
