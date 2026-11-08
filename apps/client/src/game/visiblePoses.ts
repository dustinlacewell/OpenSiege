import type { PoseTable } from "./poses.ts";
import type { Vision } from "./vision.ts";

/**
 * Drops the poses of units the local player cannot see. Keeps id order (order lines rely on it).
 * Hidden slots are swapped to the end, so no pose object is lost or allocated.
 */
export function keepVisible(table: PoseTable, vision: Vision): void {
  const poses = table.poses;
  let n = 0;
  for (let i = 0; i < table.count; i++) {
    const p = poses[i]!;
    if (!vision.shows(p.unit)) continue;
    if (i !== n) {
      poses[i] = poses[n]!;
      poses[n] = p;
    }
    n++;
  }
  table.count = n;
}
