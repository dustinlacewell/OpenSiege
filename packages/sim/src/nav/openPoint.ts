import { nearestOpen } from "./nearest.ts";
import { BLOCKED, cellIndexAt, centreOfCell, type NavGrid, type NavShape, type Point } from "./navGrid.ts";

/** The point itself when its cell is open, else the centre of the open cell nearest to it. */
export function openPoint(s: NavShape, grid: NavGrid, x: number, y: number): Point {
  const cell = cellIndexAt(s, x, y);
  if (grid[cell] !== BLOCKED) return { x, y };
  const open = nearestOpen(s, grid, cell);
  return open < 0 ? { x, y } : centreOfCell(s, open);
}
