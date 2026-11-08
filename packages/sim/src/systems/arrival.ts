import { UNIT_STATS } from "../stats.ts";
import { dist2 } from "../math.ts";
import { MAX_RADIUS } from "../units.ts";
import { advance, head } from "../orders.ts";
import type { Grid } from "../grid.ts";
import type { Order, Unit, World } from "../types.ts";

/** Extra gap that still counts as touching. */
const TOUCH = 8;
/** A unit stops on contact only this close to its own spot, so groups do not stop at the start. */
const CONTAGION_RANGE = 600;

type Move = Extract<Order, { type: "move" }>;

/**
 * Done rules for move orders, run after movement. In id order.
 * The last order: a unit near its spot arrives; a unit near its spot that touches
 * an own unit which already finished the same move arrives too.
 * A waypoint (more orders follow): done within two radii of its spot, so the unit flows on.
 */
export function arrival(world: World, grid: Grid): void {
  const near: number[] = [];
  for (const u of world.units) {
    const o = head(u);
    if (u.mode !== "mobile" || o?.type !== "move") continue;
    if (u.orders.length > 1) passWaypoint(u, o);
    else if (atSpot(u, o) || nearAndTouching(world, grid, u, o, near)) arrive(u, o.group);
  }
}

/** The move is done. The last move leaves the unit idle with the group as its mark. */
export function arrive(u: Unit, group: number): void {
  const last = u.orders.length === 1;
  advance(u);
  if (last) u.arrived = group;
}

function passWaypoint(u: Unit, o: Move): void {
  const r = UNIT_STATS[u.kind].radius;
  if (dist2(u.x, u.y, o.x, o.y) <= 4 * r * r) advance(u);
}

function atSpot(u: Unit, o: Move): boolean {
  const r = UNIT_STATS[u.kind].radius;
  return dist2(u.x, u.y, o.x, o.y) * 4 <= r * r;
}

function nearAndTouching(world: World, grid: Grid, u: Unit, o: Move, near: number[]): boolean {
  return dist2(u.x, u.y, o.x, o.y) <= CONTAGION_RANGE * CONTAGION_RANGE && touchesArrived(world, grid, u, o.group, near);
}

function touchesArrived(world: World, grid: Grid, u: Unit, group: number, near: number[]): boolean {
  const r = UNIT_STATS[u.kind].radius;
  for (const j of grid.query(u.x, u.y, r + MAX_RADIUS + TOUCH, near)) {
    const v = world.units[j]!;
    if (v === u || v.owner !== u.owner || v.arrived !== group || v.orders.length > 0) continue;
    const reach = r + UNIT_STATS[v.kind].radius + TOUCH;
    if (dist2(u.x, u.y, v.x, v.y) <= reach * reach) return true;
  }
  return false;
}
