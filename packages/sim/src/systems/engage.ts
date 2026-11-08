import { ENGAGE_END, ENGAGE_LEASH, ENGAGE_START, UNIT_STATS } from "../stats.ts";
import { dist2 } from "../math.ts";
import { heightAt } from "../terrain.ts";
import { findUnit } from "../units.ts";
import { weaponOf } from "../weapons.ts";
import { advance, head, pushFront } from "../orders.ts";
import { densestEnemy, nearestEnemy, reach } from "../targeting.ts";
import { canFire } from "../fireable.ts";
import { detectionFor, type Detection } from "../detection.ts";
import type { Grid } from "../grid.ts";
import type { MoveOrder, Order, Unit, World } from "../types.ts";

type EngageOrder = Extract<Order, { type: "engage" }>;

/**
 * Attack-moves start engagements; engagements end. In world order, before combat.
 * An engage is a temporary order in front of the attack-move that started it; ending it makes the attack-move the head again.
 * `grid` is the `before` grid. Only an enemy the unit's team detects (`detectionFor`) is engaged or kept.
 */
export function engage(world: World, grid: Grid, seen: Detection): void {
  const near: number[] = [];
  for (const u of world.units) {
    const o = head(u);
    const sees = detectionFor(u, seen);
    if (o?.type === "engage") endIfDone(world, sees, u, o);
    else if (o?.type === "move" && o.attack) startIfEnemy(world, grid, sees, u, o, near);
  }
}

/**
 * End the engage when the target is gone, dead or not detected, farther than effective range plus ENGAGE_END, nearer than `minRange`,
 * not `canFire`, or the unit is farther than ENGAGE_LEASH from the anchor. A leash end makes the attack-move behind skip the target.
 * A unit that lost its weapon ends it too. The attack-move behind picks the next target on a later tick.
 */
function endIfDone(world: World, seen: Detection, u: Unit, o: EngageOrder): void {
  const t = findUnit(world, o.target);
  const w = weaponOf(u);
  if (!t || t.hp <= 0 || !seen.detects(u.owner, t) || !w || !engageable(world, u, t, w.range, w.minRange, ENGAGE_END)) {
    advance(u);
    return;
  }
  if (dist2(u.x, u.y, o.x, o.y) <= ENGAGE_LEASH * ENGAGE_LEASH) return;
  advance(u);
  const next = head(u);
  if (next?.type === "move" && next.attack) next.skip = o.target;
}

/**
 * A mobile, armed unit engages the nearest detected enemy (a mine: the enemy in the biggest crowd) within effective range plus ENGAGE_START,
 * no nearer than its `minRange`, that it `canFire` on, ignoring `skip`.
 */
function startIfEnemy(world: World, grid: Grid, seen: Detection, u: Unit, o: MoveOrder, near: number[]): void {
  const w = weaponOf(u);
  if (u.mode !== "mobile" || !w) return;
  const ground = heightAt(world.terrain, u.x, u.y);
  const s = UNIT_STATS[u.kind];
  const shot = s.weapon === "mine"
    ? densestEnemy(world, grid, seen, u, w.range, ground, near, s.deathRadius, ENGAGE_START, o.skip, w.minRange)
    : nearestEnemy(world, grid, seen, u, w.range, ground, near, ENGAGE_START, o.skip, (t) => canFire(world, u, t), w.minRange);
  if (shot) pushFront(u, { type: "engage", target: shot.t.id, hold: false, x: u.x, y: u.y });
}

/** The keep rule, the start rule with `extra` widened to ENGAGE_END: in reach plus `extra`, outside `min`, and `canFire`. */
function engageable(world: World, u: Unit, t: Unit, base: number, min: number, extra: number): boolean {
  const ground = heightAt(world.terrain, u.x, u.y);
  return reach(world, u, t, base, ground, extra, min) !== undefined && canFire(world, u, t);
}
