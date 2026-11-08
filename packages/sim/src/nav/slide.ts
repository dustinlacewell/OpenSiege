import { BLOCKED, cellIndexAt, type NavGrid, type NavShape, type Point } from "./navGrid.ts";

/**
 * Where a step from (fromX, fromY) to (toX, toY) ends under the block rule: never in a blocked cell.
 * An illegal step keeps the axis that stays legal (slides along the cell edge), else the unit stays.
 * See `stepIsLegal` for what legal means.
 */
export function slide(s: NavShape, grid: NavGrid, fromX: number, fromY: number, toX: number, toY: number): Point {
  if (stepIsLegal(s, grid, fromX, fromY, toX, toY)) return { x: toX, y: toY };
  if (stepIsLegal(s, grid, fromX, fromY, toX, fromY)) return { x: toX, y: fromY };
  if (stepIsLegal(s, grid, fromX, fromY, fromX, toY)) return { x: fromX, y: toY };
  return { x: fromX, y: fromY };
}

/**
 * From open ground a step is legal when it ends in an open cell and, if it crosses a cell corner,
 * both cells beside that corner are open too (the path search cuts no corner either).
 * From inside a blocked cell every step is legal, so a unit always gets out (`escape.ts` leads it).
 */
function stepIsLegal(s: NavShape, grid: NavGrid, fromX: number, fromY: number, toX: number, toY: number): boolean {
  const from = cellIndexAt(s, fromX, fromY), to = cellIndexAt(s, toX, toY);
  if (from === to || grid[from] === BLOCKED) return true;
  if (grid[to] === BLOCKED) return false;
  const fc = from % s.cols, fr = Math.floor(from / s.cols), tc = to % s.cols, tr = Math.floor(to / s.cols);
  if (fc === tc || fr === tr) return true;
  return grid[fr * s.cols + tc] !== BLOCKED && grid[tr * s.cols + fc] !== BLOCKED;
}
