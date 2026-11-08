import type { Feature, MapSize } from "../types.ts";
import { MAX_FEATURE_RADIUS } from "./featureStats.ts";

const BUCKET = 500;

/**
 * Static spatial hash over features, by centre. Derived from `World.features`, never sent or hashed.
 * Each bucket keeps id order, and queries walk buckets row by row: the result order is fixed.
 */
export interface FeatureIndex {
  /** Features with a centre inside the square around (x, y) ± (r + MAX_FEATURE_RADIUS), so every circle touching ± r is in. Caller checks exact distance. */
  query(x: number, y: number, r: number, out: Feature[]): Feature[];
  /** Append a feature whose id is above every id in the index. Used while placing. */
  add(f: Feature): void;
  remove(f: Feature): void;
}

/** Bucket column or row of a coordinate, clamped to `side` buckets. Features that overhang the map edge land in the edge bucket. */
function bucketCoord(v: number, side: number): number {
  const c = Math.floor(v / BUCKET);
  return c < 0 ? 0 : c >= side ? side - 1 : c;
}

export function createFeatureIndex(features: readonly Feature[], m: MapSize): FeatureIndex {
  const sideX = Math.ceil(m.width / BUCKET), sideY = Math.ceil(m.height / BUCKET);
  const buckets: Feature[][] = Array.from({ length: sideX * sideY }, () => []);
  const bucketOf = (f: Feature) => buckets[bucketCoord(f.y, sideY) * sideX + bucketCoord(f.x, sideX)]!;
  for (const f of features) bucketOf(f).push(f);
  return {
    query(x, y, r, out) {
      out.length = 0;
      const pad = r + MAX_FEATURE_RADIUS;
      const x0 = bucketCoord(x - pad, sideX), x1 = bucketCoord(x + pad, sideX);
      const y0 = bucketCoord(y - pad, sideY), y1 = bucketCoord(y + pad, sideY);
      for (let cy = y0; cy <= y1; cy++) {
        for (let cx = x0; cx <= x1; cx++) for (const f of buckets[cy * sideX + cx]!) out.push(f);
      }
      return out;
    },
    add(f) {
      bucketOf(f).push(f);
    },
    remove(f) {
      const b = bucketOf(f);
      const k = b.indexOf(f);
      if (k >= 0) b.splice(k, 1);
    },
  };
}
