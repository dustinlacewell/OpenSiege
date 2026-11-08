import { findUnit } from "../units.ts";
import { advance, head, moveOrder } from "../orders.ts";
import { isAnchored } from "../siege.ts";
import { detectionFor, type Detection } from "../detection.ts";
import type { Order, Unit, World } from "../types.ts";

type CloseOrder = Extract<Order, { type: "attack" | "engage" }>;

/**
 * Check each living unit's head attack or engage against `seen` (`detectionFor`). Right after `seen` is built.
 * A detected target: an attack's last detected spot (`x, y`) moves to the target.
 * A lost target: an attack becomes a plain move to its last detected spot, never to where the target is now;
 * an anchored unit drops the attack instead, so it does not pack up. An engage ends, so the attack-move behind drives on.
 * A dead or gone target is `movement`'s to end. Guards guard only their owner's own units; `guardEnemy` picks only detected enemies.
 * Only the head: a queued attack is checked when it comes up.
 */
export function lostTargets(world: World, seen: Detection): void {
  for (const u of world.units) {
    const o = head(u);
    if (u.hp <= 0 || (o?.type !== "attack" && o?.type !== "engage")) continue;
    const t = findUnit(world, o.target);
    if (!t || t.hp <= 0) continue;
    if (detectionFor(u, seen).detects(u.owner, t)) track(o, t);
    else drop(u, o);
  }
}

/** An attack keeps the target's spot as its last detected one. */
function track(o: CloseOrder, t: Unit): void {
  if (o.type !== "attack") return;
  o.x = t.x;
  o.y = t.y;
}

/** A mobile or packing unit's attack turns into a move to the last detected spot; the target id is the move's group. Else the order ends, as `engage.ts` ends an engage. */
function drop(u: Unit, o: CloseOrder): void {
  if (o.type === "attack" && !isAnchored(u)) u.orders[0] = moveOrder(o.x, o.y, o.target, false);
  else advance(u);
}
