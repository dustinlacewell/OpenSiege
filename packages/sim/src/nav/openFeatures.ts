import type { Feature, Terrain } from "../types.ts";
import { stampFeature } from "./featureCells.ts";
import { refreshCells } from "./navGrid.ts";
import { CLEARANCE_RADIUS, MOVE_CLASSES } from "./moveClass.ts";
import type { NavState } from "./navState.ts";
import { labelRegions } from "./regions.ts";

/**
 * Blocking features are gone: open the cells they covered, for every class. Rebuilds those cells
 * (the box of each class covers its grown circle) and relabels the regions once.
 * The result equals a nav built fresh from the world without them.
 */
export function openFeatures(nav: NavState, terrain: Terrain, gone: readonly Feature[]): void {
  const s = nav.shape;
  for (const cls of MOVE_CLASSES) {
    const pad = CLEARANCE_RADIUS[cls];
    const boxes = gone.map((f) => stampFeature(s, nav.featureBlock[cls], f, pad, -1));
    for (const box of boxes) refreshCells(s, nav.grids[cls], terrain, cls, nav.featureBlock[cls], box);
    nav.regions[cls] = labelRegions(s, nav.grids[cls]);
  }
}
