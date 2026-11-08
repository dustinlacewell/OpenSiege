import { detonate, NO_UNIT } from "./blast.ts";
import type { Grid } from "./grid.ts";
import type { SimState } from "./simState.ts";
import type { Blast, Feature, Projectile } from "./types.ts";

export { NO_UNIT };

/** A shell lands: it becomes a blast that hurts every unit in its radius. `hit` is a unit index or NO_UNIT. */
export function impact(state: SimState, grid: Grid, p: Projectile, hit: number, struck: Feature | null, near: number[]): void {
  const blast: Blast = { x: p.x, y: p.y, z: p.z, damage: p.damage, radius: p.splash, dig: p.dig };
  detonate(state, grid, blast, hit, struck, near);
}
