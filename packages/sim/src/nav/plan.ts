import type { MoveClass } from "../stats.ts";
import { findCells } from "./astar.ts";
import { clearLine } from "./clearLine.ts";
import { nearestInRegion } from "./nearest.ts";
import { cellIndexAt, centreOfCell, type Point } from "./navGrid.ts";
import type { NavState } from "./navState.ts";
import { openPoint } from "./openPoint.ts";
import { stringPull } from "./stringPull.ts";

/** Most waypoints a path keeps. A longer one keeps its first MAX_WAYPOINTS - 1 and its last (`capPath`). */
export const MAX_WAYPOINTS = 32;

/**
 * The waypoints from `from` to `goal` for a class, the last the spot to stop at. Planned once per order.
 * A straight line with no blocked cell is just [goal]. Else A* over the grid (`findCells`) strung tight (`stringPull`).
 * A start in a blocked cell plans from the nearest open cell: the unit walks out first (`escape.ts`).
 * A goal the unit cannot reach is replaced by the nearest cell of the unit's own region, so the order still ends.
 */
export function planPath(nav: NavState, cls: MoveClass, from: Point, goal: Point): Point[] {
  const s = nav.shape, grid = nav.grids[cls];
  const start = openPoint(s, grid, from.x, from.y);
  const end = reachableGoal(nav, cls, start, goal);
  if (clearLine(s, grid, start.x, start.y, end.x, end.y)) return [end];
  const cells = findCells(s, grid, cellIndexAt(s, start.x, start.y), cellIndexAt(s, end.x, end.y));
  if (!cells) return [end];
  return capPath(stringPull(s, grid, start, cells, end));
}

/**
 * The goal, moved off blocked ground to the nearest open cell, and then, when that cell is in another
 * region than the start, to the cell of the start's region nearest to it.
 */
function reachableGoal(nav: NavState, cls: MoveClass, start: Point, goal: Point): Point {
  const s = nav.shape;
  const open = openPoint(s, nav.grids[cls], goal.x, goal.y);
  const regions = nav.regions[cls];
  const label = regions[cellIndexAt(s, start.x, start.y)]!;
  if (regions[cellIndexAt(s, open.x, open.y)] === label) return open;
  const near = nearestInRegion(s, regions, cellIndexAt(s, open.x, open.y), label);
  return near < 0 ? open : centreOfCell(s, near);
}

/**
 * Keeps the path within MAX_WAYPOINTS: the first ones and the last. The unit that reaches the gap cannot see the
 * last point, which makes it plan again from there (`route.ts`).
 */
function capPath(path: Point[]): Point[] {
  if (path.length <= MAX_WAYPOINTS) return path;
  return [...path.slice(0, MAX_WAYPOINTS - 1), path[path.length - 1]!];
}
