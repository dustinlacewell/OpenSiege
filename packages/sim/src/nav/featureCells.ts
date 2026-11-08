import type { Feature } from "../types.ts";
import { cellCentre, colOf, rowOf, type CellBox, type NavShape } from "./navGrid.ts";

/** Box of cells a blocking feature may cover, its circle grown by `pad` world units (a class's clearance radius). Clamped to the grid. */
export function coveredBox(s: NavShape, f: Feature, pad: number): CellBox {
  const r = f.radius + pad;
  return { i0: colOf(s, f.x - r), j0: rowOf(s, f.y - r), i1: colOf(s, f.x + r), j1: rowOf(s, f.y + r) };
}

/**
 * Add `delta` to the count of every cell a feature covers: the cell holding its centre, and every cell
 * whose centre lies inside its circle grown by `pad` (a move class's clearance radius). A boulder blocks a few cells,
 * a rock several. Returns the box it touched.
 */
export function stampFeature(s: NavShape, mask: Uint8Array, f: Feature, pad: number, delta: 1 | -1): CellBox {
  const box = coveredBox(s, f, pad);
  const home = rowOf(s, f.y) * s.cols + colOf(s, f.x);
  const r = f.radius + pad;
  for (let j = box.j0; j <= box.j1; j++) {
    for (let i = box.i0; i <= box.i1; i++) {
      const dx = cellCentre(s, i) - f.x, dy = cellCentre(s, j) - f.y;
      if (j * s.cols + i === home || dx * dx + dy * dy <= r * r) mask[j * s.cols + i]! += delta;
    }
  }
  return box;
}
