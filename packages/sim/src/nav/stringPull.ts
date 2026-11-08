import { clearLine } from "./clearLine.ts";
import { centreOfCell, type NavGrid, type NavShape, type Point } from "./navGrid.ts";

/**
 * Straightens a cell path into waypoints. From the current point, jump to the farthest later cell it sees along a
 * clear line (`clearLine`): the walk stops at the first cell that is out of sight, so it costs one line per cell.
 * `cells` starts at the cell holding `from` and ends at the cell holding `goal`. The waypoints are the centres of the
 * cells chosen; the last is `goal` itself. The next cell is always taken, so the walk moves on.
 */
export function stringPull(s: NavShape, grid: NavGrid, from: Point, cells: readonly number[], goal: Point): Point[] {
  const points = cells.slice(1).map((c) => centreOfCell(s, c));
  if (points.length === 0) return [goal];
  points[points.length - 1] = goal;
  const out: Point[] = [];
  let at = from;
  let next = 0;
  while (next < points.length) {
    let far = next;
    while (far + 1 < points.length && clearLine(s, grid, at.x, at.y, points[far + 1]!.x, points[far + 1]!.y)) far++;
    at = points[far]!;
    out.push(at);
    next = far + 1;
  }
  return out;
}
