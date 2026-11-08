import { FEATURE_STATS, isDestroyed } from "../features/featureStats.ts";
import { wreckageOf } from "../features/wreck.ts";
import { openFeatures } from "../nav/openFeatures.ts";
import { reshapeTerrain } from "../nav/reshapeTerrain.ts";
import type { SimState } from "../simState.ts";
import type { Feature } from "../types.ts";

/**
 * The one point of a tick where features leave: those with no hp left (crushed or shelled) are removed
 * from the world and the index. A scrap destroyed by shells or crushing leaves wreckage in its place.
 * A scrap in `reclaimed` (engineers took its last hp, `repair`) leaves nothing. If any removed feature blocked movement,
 * the nav opens their cells in this same tick.
 * Then the nav follows any terrain the tick reshaped (`terrainDirty`).
 */
export function reap(state: SimState, reclaimed: ReadonlySet<number>): void {
  const world = state.world;
  if (world.features.some(isDestroyed)) {
    const gone = world.features.filter(isDestroyed);
    world.features = world.features.filter((f) => !isDestroyed(f));
    for (const f of gone) state.features.remove(f);
    leaveWreckage(state, gone, reclaimed);
    const blockers = gone.filter((f) => FEATURE_STATS[f.kind].blocksMove);
    if (blockers.length > 0) openFeatures(state.nav, world.terrain, blockers);
  }
  if (state.terrainDirty.length > 0) reshapeTerrain(state.nav, world.terrain, state.terrainDirty);
}

/**
 * Each destroyed scrap, in id order, is replaced by wreckage with a new id, unless it was reclaimed.
 * Wreckage blocks nothing: the nav needs no change.
 */
function leaveWreckage(state: SimState, gone: readonly Feature[], reclaimed: ReadonlySet<number>): void {
  for (const f of gone) {
    if (f.kind !== "scrap" || reclaimed.has(f.id)) continue;
    const w = wreckageOf(f, state.world.nextId++);
    state.world.features.push(w);
    state.features.add(w);
  }
}
