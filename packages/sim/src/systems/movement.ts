import { UNIT_STATS } from "../stats.ts";
import { angleDelta, angleOf, dist2, isqrt, turnToward } from "../math.ts";
import { clampX, clampY } from "../mapSize.ts";
import { TRIG_ONE, cosStep, sinStep } from "../trig.ts";
import { findUnit } from "../units.ts";
import { slopeSpeed } from "../slope.ts";
import { CLASS_PARAMS } from "../nav/moveClass.ts";
import { advance, head } from "../orders.ts";
import { heightAt } from "../terrain.ts";
import { inWater } from "../terrain/water.ts";
import { weaponOf, type Weapon } from "../weapons.ts";
import { rangeTo } from "../targeting.ts";
import { holdBand } from "../holdBand.ts";
import { canFire } from "../fireable.ts";
import { arrive } from "./arrival.ts";
import { guardGoal, guardedUnit, type GuardOrder } from "../guard.ts";
import { inReclaimReach, reclaimTarget } from "../reclaim.ts";
import { isAnchored, startPacking } from "../siege.ts";
import { routeAim, unstick } from "../nav/route.ts";
import { slide } from "../nav/slide.ts";
import { escapeAim } from "../nav/escape.ts";
import { slowPercentAt } from "../features/featureSlow.ts";
import type { SimState } from "../simState.ts";
import { detectionFor, type Detection } from "../detection.ts";
import type { Grid } from "../grid.ts";
import type { Feature, MapSize, MoveOrder, Order, Unit } from "../types.ts";

/**
 * Units follow their head order: mobile ones walk to a point, close on a target until in range, keep near a guarded unit,
 * or drive to a scrap to reclaim. An attack, engage, guard or reclaim on a gone target ends in any mode, so it never blocks the queue.
 * `grid` is the `before` grid; guards query it for enemies and patients. `seen` is the tick's detection; guards close only on enemies they detect (`detectionFor`).
 * Move orders follow a path planned around blocked ground (`nav/route.ts`). Attack, engage and guard drive straight at a moving target.
 * Every step obeys the block rule (`nav/slide.ts`).
 */
export function movement(state: SimState, grid: Grid, seen: Detection, m: MapSize): void {
  const world = state.world;
  const near: number[] = [];
  const nearF: Feature[] = [];
  for (const u of world.units) {
    const o = head(u);
    if (o?.type === "attack" || o?.type === "engage") closeOrder(state, m, u, o, nearF);
    else if (o?.type === "guard") guardOrder(state, m, grid, seen, u, o, near, nearF);
    else if (o?.type === "reclaim") reclaimOrder(state, m, u, nearF);
    else if (o?.type === "move" && u.mode === "mobile") moveOrder(state, m, u, o, nearF);
  }
}

/**
 * A move drives its route, attack-move included: an engage in front of it does the fighting (`engage.ts`).
 * Reaching the last waypoint finishes the order. A stall plans again (`unstick`) and never ends it.
 */
function moveOrder(state: SimState, m: MapSize, u: Unit, o: MoveOrder, nearF: Feature[]): void {
  const aim = routeAim(state.nav, u, o);
  if (stepToward(state, m, u, aim.x, aim.y, nearF) && aim.end) arrive(u, o.group);
  else unstick(state.nav, u, o);
}

type CloseOrder = Extract<Order, { type: "attack" | "engage" }>;

/** Attack and engage close on their target. A gone target ends the order, in any mode. */
function closeOrder(state: SimState, m: MapSize, u: Unit, o: CloseOrder, nearF: Feature[]): void {
  const t = findUnit(state.world, o.target);
  if (!t || t.hp <= 0) {
    advance(u);
    return;
  }
  if (u.mode !== "mobile") return;
  const w = weaponOf(u);
  if (w) closeToFire(state, m, u, o, t, w, nearF);
  else closeToContact(state, m, u, t, nearF);
}

/**
 * Drive at `t` until inside the far edge of the hold band, then hold until `t` leaves the effective range.
 * The gap between the two is a dead band, so a target on the edge of range does not make the hull flicker. Writes `o.hold`.
 * A target inside the near edge (`minRange` plus a margin, `holdBand.ts`) makes the unit back off to it, whatever `hold` says.
 * A holding attack with no firing solution keeps closing (`closeForArc`).
 */
function closeToFire(state: SimState, m: MapSize, u: Unit, o: CloseOrder, t: Unit, w: Weapon, nearF: Feature[]): void {
  const range = rangeTo(state.world, t, w.range, heightAt(state.world.terrain, u.x, u.y));
  const band = holdBand(range, w.minRange);
  const d = dist2(u.x, u.y, t.x, t.y);
  if (o.hold && d > range * range) o.hold = false;
  else if (!o.hold && d <= band.far * band.far) o.hold = true;
  if (d < band.near * band.near) backOff(state, m, u, t, band.near, nearF);
  else if (!o.hold) stepToward(state, m, u, t.x, t.y, nearF);
  else if (o.type === "attack") closeForArc(state, m, u, t, band.near, d, nearF);
}

/**
 * A holding attack with no firing solution (`canFire`: terrain blocks every arc) keeps closing until it has one.
 * It stops at contact (own radius plus the target's), or at the near edge of the band if that is farther, so it never flips with `backOff`.
 * Engage and guard do not need this: they drop a target with no arc and pick another.
 */
function closeForArc(state: SimState, m: MapSize, u: Unit, t: Unit, near: number, d: number, nearF: Feature[]): void {
  const gap = Math.max(near, UNIT_STATS[u.kind].radius + UNIT_STATS[t.kind].radius);
  if (d <= gap * gap || canFire(state.world, u, t)) return;
  backOff(state, m, u, t, gap, nearF);
}

/** Drive straight along the line from `t` to the point `gap` from it, away or toward. On top of `t`, away is the way the hull faces. */
function backOff(state: SimState, m: MapSize, u: Unit, t: Unit, gap: number, nearF: Feature[]): void {
  const dx = u.x - t.x, dy = u.y - t.y;
  const d = isqrt(dx * dx + dy * dy);
  const x = d > 0 ? t.x + Math.trunc((dx * gap) / d) : u.x + Math.trunc((cosStep(u.facing) * gap) / TRIG_ONE);
  const y = d > 0 ? t.y + Math.trunc((dy * gap) / d) : u.y + Math.trunc((sinStep(u.facing) * gap) / TRIG_ONE);
  stepToward(state, m, u, x, y, nearF);
}

/** Unarmed units follow to contact instead of chasing forever. */
function closeToContact(state: SimState, m: MapSize, u: Unit, t: Unit, nearF: Feature[]): void {
  const s = UNIT_STATS[u.kind];
  const hold = Math.max(s.range, s.radius + UNIT_STATS[t.kind].radius);
  if (dist2(u.x, u.y, t.x, t.y) > hold * hold) stepToward(state, m, u, t.x, t.y, nearF);
}

/**
 * A dead or gone target ends the order, in any mode. A guard that must move packs up first
 * if anchored, as a move coming up does; a mobile one drives to the goal from `guard.ts`.
 * A back-off goal moves only a mobile guard, as for attack: an anchored one stays put.
 */
function guardOrder(state: SimState, m: MapSize, grid: Grid, seen: Detection, u: Unit, o: GuardOrder, near: number[], nearF: Feature[]): void {
  const t = guardedUnit(state.world, u);
  if (!t) {
    advance(u);
    return;
  }
  const goal = guardGoal(state.world, grid, detectionFor(u, seen), u, o, t, near);
  if (!goal) return;
  if ("away" in goal) {
    if (u.mode === "mobile") backOff(state, m, u, goal.away, goal.gap, nearF);
  } else if (isAnchored(u)) startPacking(u);
  else if (u.mode === "mobile") stepToward(state, m, u, goal.x, goal.y, nearF, goal.speed);
}

/**
 * A scrap that is gone or has no hp left ends the order, in any mode. In reach (`reclaim.ts`) the engineer stands still;
 * `repair` does the work. Out of reach it packs up first if anchored, as a guard does; a mobile one drives at the scrap.
 */
function reclaimOrder(state: SimState, m: MapSize, u: Unit, nearF: Feature[]): void {
  const f = reclaimTarget(state.world, u);
  if (!f) {
    advance(u);
    return;
  }
  if (inReclaimReach(u, f)) return;
  if (isAnchored(u)) startPacking(u);
  else if (u.mode === "mobile") stepToward(state, m, u, f.x, f.y, nearF);
}

/**
 * One tick of travel: turn the hull toward the point by at most `turnRate`, then drive along the new facing.
 * Base speed is the unit's `speed`, capped by `cap` when given (a guard matching its target).
 * It is scaled by the angle still left to turn, by the features it stands in (`features/featureSlow.ts`),
 * by `waterSpeed` when its centre is in water (`terrain/water.ts`), and by slope.
 * The step then slides along any blocked cell.
 * A unit inside a blocked cell heads for the nearest open cell first, whatever the order (`nav/escape.ts`).
 * True when it reached the point (a slide short of it, or an escape step, is not).
 * `nearF` is a scratch buffer for feature queries.
 */
function stepToward(state: SimState, m: MapSize, u: Unit, goalX: number, goalY: number, nearF: Feature[], cap?: number): boolean {
  const terrain = state.world.terrain;
  const s = UNIT_STATS[u.kind];
  const grid = state.nav.grids[s.moveClass];
  const shape = state.nav.shape;
  const out = escapeAim(shape, grid, u.x, u.y);
  const x = out ? out.x : goalX, y = out ? out.y : goalY;
  const base = cap === undefined ? s.speed : Math.min(s.speed, cap);
  const dx = x - u.x, dy = y - u.y;
  const d = isqrt(dx * dx + dy * dy);
  const bearing = angleOf(dx, dy, u.facing);
  u.facing = turnToward(u.facing, bearing, s.turnRate);
  const error = Math.abs(angleDelta(u.facing, bearing));
  const fx = cosStep(u.facing), fy = sinStep(u.facing);
  const turned = Math.max(1, Math.floor((base * turnSpeedPct(error, d, base, s.turnRate)) / 100));
  const slowed = Math.max(1, Math.floor((turned * slowPercentAt(state.features, u.x, u.y, s.moveClass, nearF)) / 100));
  const wet = inWater(terrain, u.x, u.y) ? Math.max(1, Math.floor((slowed * s.waterSpeed) / 100)) : slowed;
  const speed = slopeSpeed(terrain, u.x, u.y, fx, fy, TRIG_ONE, wet, CLASS_PARAMS[s.moveClass].uphillMinPct);
  const reached = d <= speed;
  // Facing the point (to the angle step): drive the exact line to it. Driving the quantised facing drifts off
  // the line, the bearing slips a step, and the hull flips between two steps: a left-right wiggle.
  const onLine = error === 0 && d > 0;
  const toX = reached ? clampX(m, x) : clampX(m, u.x + (onLine ? Math.trunc((dx * speed) / d) : Math.trunc((fx * speed) / TRIG_ONE)));
  const toY = reached ? clampY(m, y) : clampY(m, u.y + (onLine ? Math.trunc((dy * speed) / d) : Math.trunc((fy * speed) / TRIG_ONE)));
  const p = slide(shape, grid, u.x, u.y, toX, toY);
  u.x = p.x;
  u.y = p.y;
  return !out && reached && p.x === toX && p.y === toY;
}

/** Angle error (steps) at which speed has fallen to HALF_PCT. About 60 degrees. */
const HALF_ERROR = 43;
const HALF_PCT = 50;
/** Speed while turning nearly in place. */
const CRAWL_PCT = 12;
/** Near the goal, an error above this crawls, so the unit turns instead of circling. */
const NEAR_ERROR = 21;
/** Goal distance below speed · NEAR_SCALE / turnRate counts as near (about the turn radius). */
const NEAR_SCALE = 128;

/** Speed percent from the angle left to turn after this tick's turn. */
function turnSpeedPct(error: number, d: number, speed: number, turnRate: number): number {
  if (error > HALF_ERROR) return CRAWL_PCT;
  if (error > NEAR_ERROR && d * turnRate < speed * NEAR_SCALE) return CRAWL_PCT;
  return 100 - Math.floor((error * (100 - HALF_PCT)) / HALF_ERROR);
}
