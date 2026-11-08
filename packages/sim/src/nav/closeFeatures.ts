import type { Feature, Terrain } from "../types.ts";
import { stampFeature } from "./featureCells.ts";
import { refreshCells } from "./navGrid.ts";
import { CLEARANCE_RADIUS, MOVE_CLASSES } from "./moveClass.ts";
import type { NavState } from "./navState.ts";
import { labelRegions } from "./regions.ts";

/**
 * Blocking features have appeared: close the cells they cover, for every class. The mirror of `openFeatures`.
 * Rebuilds those cells (the box of each class covers its grown circle) and relabels the regions once per class.
 * The result equals a nav built fresh from the world with them.
 */
export function closeFeatures(nav: NavState, terrain: Terrain, added: readonly Feature[]): void {
  const s = nav.shape;
  for (const cls of MOVE_CLASSES) {
    const pad = CLEARANCE_RADIUS[cls];
    const boxes = added.map((f) => stampFeature(s, nav.featureBlock[cls], f, pad, 1));
    for (const box of boxes) refreshCells(s, nav.grids[cls], terrain, cls, nav.featureBlock[cls], box);
    nav.regions[cls] = labelRegions(s, nav.grids[cls]);
  }
}
