import { nearestOpen } from "./nearest.ts";
import { BLOCKED, cellIndexAt, centreOfCell, type NavGrid, type NavShape, type Point } from "./navGrid.ts";

/**
 * Where a unit standing at (x, y) must head to leave blocked ground: the centre of the nearest open cell.
 * Null when it stands on open ground. Every driving order uses it first, so a unit that
 * spawned in a cliff walks out whatever it was told to do.
 */
export function escapeAim(s: NavShape, grid: NavGrid, x: number, y: number): Point | null {
  const cell = cellIndexAt(s, x, y);
  if (grid[cell] !== BLOCKED) return null;
  const open = nearestOpen(s, grid, cell);
  return open < 0 ? null : centreOfCell(s, open);
}
