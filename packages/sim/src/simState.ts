import { createFeatureIndex, type FeatureIndex } from "./features/featureIndex.ts";
import { createNavState, type NavState } from "./nav/navState.ts";
import { mapSize } from "./mapSize.ts";
import type { VertexBox, World } from "./types.ts";

/**
 * What `step` advances: the world, and the data derived from it.
 * Only `world` is sent, saved and hashed. `nav` and `features` are rebuilt by `createSimState` wherever a world appears.
 * `features` is a spatial index over `world.features` (`features/featureIndex.ts`).
 * `terrainDirty` holds the vertex boxes blasts changed this tick. `step` clears it first; the client reads it after.
 */
export interface SimState {
  world: World;
  nav: NavState;
  features: FeatureIndex;
  terrainDirty: VertexBox[];
}

/** Wraps a fresh or decoded world with its derived data. */
export function createSimState(world: World): SimState {
  return { world, nav: createNavState(world.terrain, world.features), features: createFeatureIndex(world.features, mapSize(world.terrain)), terrainDirty: [] };
}
