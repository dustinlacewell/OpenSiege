import type { Terrain, VertexBox } from "../types.ts";
import { refreshCells, type CellBox, type NavGrid, type NavShape } from "./navGrid.ts";
import { MOVE_CLASSES } from "./moveClass.ts";
import type { NavState } from "./navState.ts";
import { labelRegions } from "./regions.ts";

/**
 * The heights changed inside these vertex boxes: rebuild the cells they touch, for every class, and relabel
 * a class's regions once, only if one of its cells flipped. The result equals a nav built fresh from the world.
 */
export function reshapeTerrain(nav: NavState, terrain: Terrain, boxes: readonly VertexBox[]): void {
  const s = nav.shape;
  const cellBoxes = boxes.map((b) => cellsTouching(s, b));
  for (const cls of MOVE_CLASSES) {
    const grid = nav.grids[cls];
    let flipped = 0;
    for (const box of cellBoxes) {
      const before = copyCells(s, grid, box);
      refreshCells(s, grid, terrain, cls, nav.featureBlock[cls], box);
      flipped += countFlips(s, grid, box, before);
    }
    if (flipped > 0) nav.regions[cls] = labelRegions(s, grid);
  }
}

/** A vertex touches the four cells around it: cell (i, j) spans vertices (i, j) to (i+1, j+1). Clamped to the grid. */
function cellsTouching(s: NavShape, b: VertexBox): CellBox {
  return {
    i0: Math.max(0, b.i0 - 1),
    j0: Math.max(0, b.j0 - 1),
    i1: Math.min(s.cols - 1, b.i1),
    j1: Math.min(s.rows - 1, b.j1),
  };
}

function copyCells(s: NavShape, grid: NavGrid, box: CellBox): Uint8Array {
  const w = box.i1 - box.i0 + 1;
  const out = new Uint8Array(Math.max(0, w) * Math.max(0, box.j1 - box.j0 + 1));
  let k = 0;
  for (let j = box.j0; j <= box.j1; j++) for (let i = box.i0; i <= box.i1; i++) out[k++] = grid[j * s.cols + i]!;
  return out;
}

function countFlips(s: NavShape, grid: NavGrid, box: CellBox, before: Uint8Array): number {
  let n = 0, k = 0;
  for (let j = box.j0; j <= box.j1; j++) for (let i = box.i0; i <= box.i1; i++) if (grid[j * s.cols + i] !== before[k++]) n++;
  return n;
}
