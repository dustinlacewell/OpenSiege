import { PROJ_FP } from "./stats.ts";
import { dist2, isqrt } from "./math.ts";
import { applyDamage } from "./damage.ts";
import { damageFeature, splashFeatures } from "./features/featureDamage.ts";
import { stampCrater } from "./terrain/crater.ts";
import type { Grid } from "./grid.ts";
import type { SimState } from "./simState.ts";
import type { Blast, Feature } from "./types.ts";

export const NO_UNIT = -1;

/**
 * Apply one blast. The unit struck (index into world.units, or NO_UNIT) and the feature struck take full damage.
 * Every other unit and feature within `radius` takes the linear falloff. No unit is spared: the shooter's own and allies take damage too.
 * The ground under it dents (`terrain/crater.ts`); the changed box goes on `state.terrainDirty`.
 * `grid` indexes world.units; `near` is a scratch array.
 */
export function detonate(state: SimState, grid: Grid, blast: Blast, struckUnit: number, struckFeature: Feature | null, near: number[]): void {
  const world = state.world;
  if (struckUnit !== NO_UNIT) applyDamage(world.units[struckUnit]!, blast.damage);
  if (struckFeature) damageFeature(struckFeature, blast.damage);
  if (blast.radius > 0) splash(state, grid, blast, struckUnit, struckFeature, near);
  const box = stampCrater(world.terrain, world.dug, blast);
  if (box) state.terrainDirty.push(box);
}

function splash(state: SimState, grid: Grid, blast: Blast, struckUnit: number, struckFeature: Feature | null, near: number[]): void {
  const units = state.world.units;
  const x = Math.floor(blast.x / PROJ_FP), y = Math.floor(blast.y / PROJ_FP);
  for (const i of grid.query(x, y, blast.radius, near)) {
    const t = units[i]!;
    if (i === struckUnit || t.hp <= 0) continue;
    const d = isqrt(dist2(x, y, t.x, t.y));
    if (d < blast.radius) applyDamage(t, Math.floor((blast.damage * (blast.radius - d)) / blast.radius));
  }
  splashFeatures(state.features, x, y, blast.damage, blast.radius, struckFeature);
}
