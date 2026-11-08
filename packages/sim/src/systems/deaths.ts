import { FEATURE_STATS } from "../features/featureStats.ts";
import { wreckFor } from "../features/wreck.ts";
import { closeFeatures } from "../nav/closeFeatures.ts";
import type { SimState } from "../simState.ts";
import { PROJ_FP, UNIT_STATS } from "../stats.ts";
import { heightAt } from "../terrain.ts";
import type { Unit, World } from "../types.ts";

/**
 * Queue a death blast for each destroyed unit that has one, leave scrap or wreckage where each fell, then remove the units.
 * The next tick's `projectiles` detonates the blasts.
 */
export function deaths(state: SimState): void {
  const world = state.world;
  const dead = world.units.filter((u) => u.hp <= 0);
  if (dead.length === 0) return;
  for (const u of dead) queueDeathBlast(world, u);
  leaveWrecks(state, dead);
  world.units = world.units.filter((u) => u.hp > 0);
}

function queueDeathBlast(world: World, u: Unit): void {
  const s = UNIT_STATS[u.kind];
  if (s.deathDamage <= 0 || s.deathRadius <= 0) return;
  const ground = heightAt(world.terrain, u.x, u.y);
  world.blasts.push({
    x: u.x * PROJ_FP,
    y: u.y * PROJ_FP,
    z: (ground + Math.floor(s.height / 2)) * PROJ_FP,
    damage: deathDamageOf(u),
    radius: s.deathRadius,
    dig: s.deathDig,
  });
}

/** A mine's blast is its weapon, so a sieged mine blasts for `siegeDamage`. Any other unit blasts for `deathDamage`. */
function deathDamageOf(u: Unit): number {
  const s = UNIT_STATS[u.kind];
  return s.weapon === "mine" && u.mode === "sieged" ? s.siegeDamage : s.deathDamage;
}

/** One feature per dead unit, in unit id order. The nav closes the cells of the blocking ones in this same tick. */
function leaveWrecks(state: SimState, dead: readonly Unit[]): void {
  const world = state.world;
  const left = dead.map((u) => wreckFor(u, world.nextId++));
  for (const f of left) {
    world.features.push(f);
    state.features.add(f);
  }
  const blockers = left.filter((f) => FEATURE_STATS[f.kind].blocksMove);
  if (blockers.length > 0) closeFeatures(state.nav, world.terrain, blockers);
}
