import type { Terrain } from "../types.ts";

/** Grade of cell (i, j) in percent: the largest difference of its four corner heights, over the cell size. */
export function cellGrade(t: Terrain, i: number, j: number): number {
  const h = t.heights, s = t.cols, k = j * s + i;
  const a = h[k]!, b = h[k + 1]!, c = h[k + s]!, d = h[k + s + 1]!;
  const rise = Math.max(a, b, c, d) - Math.min(a, b, c, d);
  return Math.floor((rise * 100) / t.cell);
}
