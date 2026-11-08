import { buildGrid } from "./grid.ts";
import { detect } from "./detection.ts";
import { applyIntents } from "./intents.ts";
import { mapSize } from "./mapSize.ts";
import { modes } from "./systems/modes.ts";
import { production } from "./systems/production.ts";
import { harvest } from "./systems/harvest.ts";
import { lostTargets } from "./systems/lostTargets.ts";
import { repair } from "./systems/repair.ts";
import { engage } from "./systems/engage.ts";
import { combat } from "./systems/combat.ts";
import { movement } from "./systems/movement.ts";
import { arrival } from "./systems/arrival.ts";
import { separation } from "./systems/separation.ts";
import { crush } from "./systems/crush.ts";
import { featureContact } from "./systems/featureContact.ts";
import { projectiles } from "./systems/projectiles.ts";
import { reap } from "./systems/reap.ts";
import { deaths } from "./systems/deaths.ts";
import { elimination } from "./systems/elimination.ts";
import { fieldRegen } from "./systems/fieldRegen.ts";
import type { SimState } from "./simState.ts";
import type { Stamped } from "./types.ts";

/**
 * Advance the sim by one tick. Applies the intents in the given order, then runs the systems.
 * Mutates `state.world` in place for speed. `state.nav` is read. It changes only in `reap`,
 * when a blocking feature is destroyed.
 * Deterministic: no clock, no Math.random, integer math only.
 */
export function step(state: SimState, intents: readonly Stamped[]): void {
  const world = state.world;
  state.terrainDirty.length = 0;
  applyIntents(world, intents);
  modes(world);
  production(state);
  harvest(world);
  const m = mapSize(world.terrain);
  const before = buildGrid(world.units, m);
  // One detection for the tick: only a detected enemy can be picked or kept as a target.
  const seen = detect(world, before);
  lostTargets(world, seen);
  const reclaimed = repair(world, before);
  engage(world, before, seen);
  combat(world, before, seen);
  // Guards query `before` for enemies and patients near their target.
  movement(state, before, seen, m);
  // Arrival only changes orders, so separation can share its grid.
  const moved = buildGrid(world.units, m);
  arrival(world, moved);
  separation(state, moved, m);
  featureContact(state, m);
  // Crushing and splash only zero feature hp. `reap` is the one point where features leave and the nav opens.
  crush(state);
  projectiles(state, buildGrid(world.units, m), m);
  reap(state, reclaimed);
  deaths(state);
  elimination(world);
  fieldRegen(world);
  world.tick++;
}
