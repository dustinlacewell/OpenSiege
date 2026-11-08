import { ANGLE_STEPS, UNIT_STATS } from "../stats.ts";
import { dist2 } from "../math.ts";
import type { MoveOrder, Unit } from "../types.ts";
import { clearLine } from "./clearLine.ts";
import { BLOCKED, cellIndexAt, type NavGrid, type NavShape, type Point } from "./navGrid.ts";
import type { NavState } from "./navState.ts";
import { planPath } from "./plan.ts";
import { aimAlong, lookDistance, pathLength, type Aim } from "./pursuit.ts";

/** Ticks a unit may go without getting nearer its spot before it plans again. A turn in place gets extra (`stallLimit`). */
const STALL_TICKS = 30;

/**
 * Where unit `u` aims this tick on its move order `o`: the follower of the planned path (`plan.ts`).
 * The order plans on its first drive, from where the unit then stands; a queued move so plans when it comes up.
 * It plans again when the next waypoint is out of sight, say after a shove past a corner.
 * Waypoints the unit has passed are dropped. The aim is a look-ahead point on the path (`pursuit.ts`); where the line
 * to it is blocked, the next waypoint instead.
 * A unit in a blocked cell is led out by `escapeAim` in `stepToward`, not here.
 * Chase and guard do not call this: their target moves, so they drive straight and obey only the block rule.
 */
export function routeAim(nav: NavState, u: Unit, o: MoveOrder): Aim {
  const s = UNIT_STATS[u.kind];
  const shape = nav.shape, grid = nav.grids[s.moveClass];
  const open = grid[cellIndexAt(shape, u.x, u.y)] !== BLOCKED;
  if (o.path.length === 0) planFirst(nav, u, o);
  else if (open && !clearLine(shape, grid, u.x, u.y, o.path[0]!.x, o.path[0]!.y)) replan(nav, u, o);
  const look = lookDistance(s.radius, s.speed, s.turnRate);
  dropPassed(shape, grid, u, o.path, look, s.speed);
  const aim = aimAlong(u, o.path, look);
  if (open && !clearLine(shape, grid, u.x, u.y, aim.x, aim.y)) return { ...o.path[0]!, end: o.path.length === 1 };
  return aim;
}

/**
 * Called on a tick the unit did not arrive. When it has made no progress toward its spot for too long, it plans
 * again from where it stands and starts the count over, so a unit boxed in keeps trying on a timer. The order never ends here.
 * Progress is a fall in the path length left. A unit inside a blocked cell is walking out, so it does not count.
 */
export function unstick(nav: NavState, u: Unit, o: MoveOrder): void {
  const s = UNIT_STATS[u.kind];
  if (nav.grids[s.moveClass][cellIndexAt(nav.shape, u.x, u.y)] === BLOCKED) {
    o.stall = 0;
    return;
  }
  const left = pathLength(u, o.path);
  if (left < o.best) {
    o.best = left;
    o.stall = 0;
    return;
  }
  if (++o.stall < stallLimit(s.turnRate)) return;
  planFirst(nav, u, o);
}

/** STALL_TICKS, plus the time to turn half way round: a hull turning in place crawls and gets nowhere. */
function stallLimit(turnRate: number): number {
  return STALL_TICKS + Math.ceil(ANGLE_STEPS / 2 / turnRate);
}

function planFirst(nav: NavState, u: Unit, o: MoveOrder): void {
  replan(nav, u, o);
  o.best = pathLength(u, o.path);
  o.stall = 0;
}

/** Plan from where the unit stands now. `best` and `stall` stay, so a replan on a lost line of sight cannot hide a stall. */
function replan(nav: NavState, u: Unit, o: MoveOrder): void {
  o.path = planPath(nav, UNIT_STATS[u.kind].moveClass, u, { x: o.x, y: o.y });
}

/**
 * Drops the first waypoint while the unit is within `reach` of it, or within `look` of it and sees the one
 * after, so it cuts the corner. The last waypoint stays: reaching it ends the order.
 */
function dropPassed(s: NavShape, grid: NavGrid, u: Unit, path: Point[], look: number, reach: number): void {
  while (path.length > 1) {
    const d2 = dist2(u.x, u.y, path[0]!.x, path[0]!.y);
    const cuts = d2 <= look * look && clearLine(s, grid, u.x, u.y, path[1]!.x, path[1]!.y);
    if (d2 > reach * reach && !cuts) return;
    path.shift();
  }
}
