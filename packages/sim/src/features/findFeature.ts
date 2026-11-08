import type { Feature, World } from "../types.ts";

/** Binary search: features are sorted by id. */
export function findFeature(world: World, id: number): Feature | undefined {
  const features = world.features;
  let lo = 0, hi = features.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >>> 1;
    const f = features[mid]!;
    if (f.id === id) return f;
    if (f.id < id) lo = mid + 1;
    else hi = mid - 1;
  }
  return undefined;
}
