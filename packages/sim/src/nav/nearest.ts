import { BLOCKED, type NavGrid, type NavShape } from "./navGrid.ts";
import type { Regions } from "./regions.ts";

/**
 * The cell nearest to `cell` that `accept` takes, by squared centre distance; `cell` itself when taken.
 * Ties go to the lower index. -1 when no cell is taken.
 */
function nearestWhere(s: NavShape, cell: number, accept: (i: number) => boolean): number {
  if (accept(cell)) return cell;
  const cx = cell % s.cols, cy = Math.floor(cell / s.cols);
  const reach = Math.max(s.cols, s.rows);
  let best = -1, bestD = Number.MAX_SAFE_INTEGER;
  // Ring r holds only cells at least r away, so stop once r² passes the best.
  for (let r = 1; r < reach && r * r <= bestD; r++) {
    for (let dy = -r; dy <= r; dy++) {
      const y = cy + dy;
      if (y < 0 || y >= s.rows) continue;
      const stride = dy === -r || dy === r ? 1 : 2 * r;
      for (let dx = -r; dx <= r; dx += stride) {
        const x = cx + dx;
        if (x < 0 || x >= s.cols) continue;
        const i = y * s.cols + x;
        const d = dx * dx + dy * dy;
        if ((d < bestD || (d === bestD && i < best)) && accept(i)) { best = i; bestD = d; }
      }
    }
  }
  return best;
}

/** The open cell nearest to `cell`; `cell` itself when open. -1 when every cell is blocked. */
export function nearestOpen(s: NavShape, grid: NavGrid, cell: number): number {
  return nearestWhere(s, cell, (i) => grid[i] !== BLOCKED);
}

/** The cell of region `label` (`regions.ts`) nearest to `cell`. -1 when the region has no cell. */
export function nearestInRegion(s: NavShape, regions: Regions, cell: number, label: number): number {
  return nearestWhere(s, cell, (i) => regions[i] === label);
}
