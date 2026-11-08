import type { MoveClass } from "../stats.ts";
import type { Feature, Terrain } from "../types.ts";
import { FEATURE_STATS } from "../features/featureStats.ts";
import { stampFeature } from "./featureCells.ts";
import { buildNavGrid, navShape, type NavGrid, type NavShape } from "./navGrid.ts";
import { CLEARANCE_RADIUS, MOVE_CLASSES } from "./moveClass.ts";
import { labelRegions, type Regions } from "./regions.ts";

/**
 * Everything derived from the world for movement. Never in `World`, never in the snapshot or the hash:
 * `createSimState` rebuilds it from the heights and the features.
 * `shape` is the grid's size, from the terrain; every grid and mask below has `shape.cols * shape.rows` cells.
 * `featureBlock` counts, per class, the blocking features over each cell, each circle grown by the class's clearance radius.
 * Keeping it lets one feature be lifted out (`openFeatures.ts`).
 * `regions` labels the connected open cells of each grid (`regions.ts`).
 */
export interface NavState {
  shape: NavShape;
  featureBlock: Record<MoveClass, Uint8Array>;
  grids: Record<MoveClass, NavGrid>;
  regions: Record<MoveClass, Regions>;
}

export function createNavState(terrain: Terrain, features: readonly Feature[]): NavState {
  const shape = navShape(terrain);
  const featureBlock = {} as Record<MoveClass, Uint8Array>;
  const grids = {} as Record<MoveClass, NavGrid>;
  const regions = {} as Record<MoveClass, Regions>;
  for (const cls of MOVE_CLASSES) {
    featureBlock[cls] = new Uint8Array(shape.cols * shape.rows);
    for (const f of features) if (FEATURE_STATS[f.kind].blocksMove) stampFeature(shape, featureBlock[cls], f, CLEARANCE_RADIUS[cls], 1);
    grids[cls] = buildNavGrid(terrain, cls, featureBlock[cls]);
    regions[cls] = labelRegions(shape, grids[cls]);
  }
  return { shape, featureBlock, grids, regions };
}
