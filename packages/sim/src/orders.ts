import { MAX_ORDERS } from "./stats.ts";
import type { MoveOrder, Order, Unit } from "./types.ts";

/** A move to the spot (x, y) with no path yet: the unit plans one when it first drives the order. */
export function moveOrder(x: number, y: number, group: number, attack: boolean): MoveOrder {
  return { type: "move", x, y, group, attack, path: [], best: 0, stall: 0, skip: 0 };
}

/** The order that runs now, or undefined when idle. */
export function head(u: Unit): Order | undefined {
  return u.orders[0];
}

/** Put `order` at the head; the old head waits behind it. May leave the queue at MAX_ORDERS + 1. */
export function pushFront(u: Unit, order: Order): void {
  u.orders.unshift(order);
}

/** The head is done. A move that comes up next clears the finished-move mark. */
export function advance(u: Unit): void {
  u.orders.shift();
  if (u.orders[0]?.type === "move") u.arrived = 0;
}

/** Append when `queue`, else replace the queue. Appends past MAX_ORDERS drop. Clears the finished-move mark. */
export function give(u: Unit, order: Order, queue: boolean): void {
  if (!queue) u.orders = [order];
  else if (u.orders.length < MAX_ORDERS) u.orders.push(order);
  u.arrived = 0;
}

/** The last queued move's destination, if any. */
export function lastMove(u: Unit): { x: number; y: number } | undefined {
  for (let i = u.orders.length - 1; i >= 0; i--) {
    const o = u.orders[i]!;
    if (o.type === "move") return { x: o.x, y: o.y };
  }
  return undefined;
}
