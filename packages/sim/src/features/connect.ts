import { CLEARANCE_RADIUS, MOVE_CLASSES } from "../nav/moveClass.ts";
import { coveredBox } from "../nav/featureCells.ts";
import { growBox, type NavShape } from "../nav/navGrid.ts";
import { createNavState } from "../nav/navState.ts";
import type { Regions } from "../nav/regions.ts";
import type { Feature, World } from "../types.ts";
import { FEATURE_STATS } from "./featureStats.ts";

/** Passes of removal. Each removes the blockers beside every cut-off pocket. */
const MAX_PASSES = 4;
/** A blocker whose cells (clearance included) lie within this many cells of a pocket cell goes. */
const NEAR_CELLS = 3;
/** The widest clearance radius of any class: the box that holds the cells a blocker covers for every class. */
const WIDEST_PAD = Math.max(...MOVE_CLASSES.map((cls) => CLEARANCE_RADIUS[cls]));

/**
 * Remove blocking features until none cuts open ground off. A cell is cut off when it is open, the bare terrain
 * connects it to the biggest region of a class, and with the features it is in another region. So no feature can seal a
 * valley, a field or a spawn area. Runs once, at placement.
 */
export function keepConnected(world: World): void {
  const bareNav = createNavState(world.terrain, []);
  const bare = bareNav.regions, s = bareNav.shape, cells = s.cols * s.rows;
  for (let pass = 0; pass < MAX_PASSES; pass++) {
    const nav = createNavState(world.terrain, world.features);
    const cut = new Uint8Array(cells);
    let any = false;
    for (const cls of MOVE_CLASSES) {
      const wasMain = biggest(bare[cls]), isMain = biggest(nav.regions[cls]);
      for (let c = 0; c < cells; c++) {
        const label = nav.regions[cls][c]!;
        if (bare[cls][c] === wasMain && label !== 0 && label !== isMain) { cut[c] = 1; any = true; }
      }
    }
    if (!any) return;
    world.features = world.features.filter((f) => !(FEATURE_STATS[f.kind].blocksMove && nearCut(s, f, cut)));
  }
}

/** Label of the region with the most cells. */
function biggest(regions: Regions): number {
  const size = new Map<number, number>();
  for (const l of regions) if (l !== 0) size.set(l, (size.get(l) ?? 0) + 1);
  let best = 0, bestSize = 0;
  for (const [label, n] of size) if (n > bestSize) { best = label; bestSize = n; }
  return best;
}

function nearCut(s: NavShape, f: Feature, cut: Uint8Array): boolean {
  const box = growBox(s, coveredBox(s, f, WIDEST_PAD), NEAR_CELLS);
  for (let j = box.j0; j <= box.j1; j++) {
    for (let i = box.i0; i <= box.i1; i++) if (cut[j * s.cols + i]) return true;
  }
  return false;
}
