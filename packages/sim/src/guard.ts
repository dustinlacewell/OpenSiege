import { GUARD_LEASH, GUARD_MARGIN, GUARD_RANGE, GUARD_RETURN, MOBILE_REPAIR_REACH, UNIT_STATS } from "./stats.ts";
import { dist2, isqrt } from "./math.ts";
import { findUnit } from "./units.ts";
import { head } from "./orders.ts";
import { isPatient } from "./patient.ts";
import { weaponOf } from "./weapons.ts";
import { isEnemy } from "./teams.ts";
import { holdBand } from "./holdBand.ts";
import type { Detection } from "./detection.ts";
import type { Grid } from "./grid.ts";
import type { Order, Unit, World } from "./types.ts";

export type GuardOrder = Extract<Order, { type: "guard" }>;

interface Point { x: number; y: number }

/** A point to drive to. `speed`, when set, caps the guard's base speed this tick. */
export interface GuardGoal extends Point { speed?: number }

/** An enemy inside the near edge of the hold band (`holdBand.ts`): back off from it to `gap`. */
export interface GuardBackOff { away: Unit; gap: number }

/** The living unit `u`'s head guard order protects, or undefined. */
export function guardedUnit(world: World, u: Unit): Unit | undefined {
  const o = head(u);
  if (o?.type !== "guard") return undefined;
  const t = findUnit(world, o.target);
  return t && t.hp > 0 ? t : undefined;
}

/**
 * The enemy of `u` that `seen` detects, nearest to the guarded unit `t`, within GUARD_RANGE of it. Ties go to the lower id.
 * `accept`, when given, must pass too; it runs only for an enemy that would beat the best so far.
 */
export function guardEnemy(world: World, grid: Grid, seen: Detection, u: Unit, t: Unit, near: number[], accept?: (e: Unit) => boolean): Unit | undefined {
  let best: Unit | undefined;
  let bestD = GUARD_RANGE * GUARD_RANGE + 1;
  for (const i of grid.query(t.x, t.y, GUARD_RANGE, near)) {
    const e = world.units[i]!;
    if (e.hp <= 0 || !isEnemy(world.players, u.owner, e.owner) || !seen.detects(u.owner, e)) continue;
    const d = dist2(t.x, t.y, e.x, e.y);
    const beats = d < bestD || (d === bestD && best && e.id < best.id);
    if (beats && (!accept || accept(e))) { bestD = d; best = e; }
  }
  return best;
}

/** The most hurt patient of engineer `e` (lowest hp share) within GUARD_RANGE of `t`, `t` included. Ties go to the lower id. */
export function guardPatient(world: World, grid: Grid, e: Unit, t: Unit, near: number[]): Unit | undefined {
  let best: Unit | undefined;
  for (const i of grid.query(t.x, t.y, GUARD_RANGE, near)) {
    const p = world.units[i]!;
    if (!isPatient(e, p) || dist2(t.x, t.y, p.x, p.y) > GUARD_RANGE * GUARD_RANGE) continue;
    if (!best || hurtFirst(p, best) < 0) best = p;
  }
  return best;
}

/** Negative when `a` is more hurt than `b` by hp share, then by lower id. */
function hurtFirst(a: Unit, b: Unit): number {
  const d = a.hp * UNIT_STATS[b.kind].maxHp - b.hp * UNIT_STATS[a.kind].maxHp;
  return d !== 0 ? d : a.id - b.id;
}

/**
 * Where guard `u` drives this tick, or undefined to stand. Armed guards close on the detected enemy nearest `t`,
 * engineers on the most hurt friendly near `t`, never past the leash plus GUARD_MARGIN.
 * An armed guard nearer that enemy than its hold band's `near` backs off from it instead.
 * With no such job, the guard follows `t`. Writes `o.chase`.
 */
export function guardGoal(world: World, grid: Grid, seen: Detection, u: Unit, o: GuardOrder, t: Unit, near: number[]): GuardGoal | GuardBackOff | undefined {
  const job = guardJob(world, grid, seen, u, t, near);
  return job ? engageGoal(u, t, job) : followGoal(u, o, t);
}

/** A point to reach, the distance from it that is close enough, and for an enemy the near edge of the hold band. */
interface Job extends Point { reach: number; near: number; enemy?: Unit }

function guardJob(world: World, grid: Grid, seen: Detection, u: Unit, t: Unit, near: number[]): Job | undefined {
  const s = UNIT_STATS[u.kind];
  if (u.kind === "engineer") {
    const p = guardPatient(world, grid, u, t, near);
    return p && { x: p.x, y: p.y, reach: u.mode === "sieged" ? s.workRange : MOBILE_REPAIR_REACH, near: 0 };
  }
  if (s.damage <= 0) return undefined;
  const e = guardEnemy(world, grid, seen, u, t, near);
  const w = weaponOf(u);
  return e && { x: e.x, y: e.y, reach: w?.range ?? s.range, near: w ? holdBand(w.range, w.minRange).near : 0, enemy: e };
}

/**
 * Inside `near` of the enemy: back off. Else stand once in reach and inside the cap. Else drive to the job,
 * clamped to the cap circle around `t` and kept `near` from the job, so the drive never undoes a back-off.
 */
function engageGoal(u: Unit, t: Unit, job: Job): GuardGoal | GuardBackOff | undefined {
  const d = dist2(u.x, u.y, job.x, job.y);
  if (job.enemy && d < job.near * job.near) return { away: job.enemy, gap: job.near };
  const cap = leash(u, t, GUARD_LEASH) + GUARD_MARGIN;
  if (d <= job.reach * job.reach && dist2(u.x, u.y, t.x, t.y) <= cap * cap) return undefined;
  const goal = keepOut(clampToCircle(job, t, cap), job, t, u, job.near);
  const r = UNIT_STATS[u.kind].radius;
  return dist2(u.x, u.y, goal.x, goal.y) <= r * r ? undefined : goal;
}

/**
 * `p`, or when it is nearer than `r` to `c`, the point `r` from `c` toward `t` (toward `u` when `t` is on `c`).
 * With `t` within GUARD_RANGE of `c`, that point is inside the cap and `r` from `c`.
 */
function keepOut(p: Point, c: Point, t: Point, u: Point, r: number): Point {
  if (dist2(p.x, p.y, c.x, c.y) >= r * r) return p;
  const to = t.x !== c.x || t.y !== c.y ? t : u;
  const dx = to.x - c.x, dy = to.y - c.y;
  const d = isqrt(dx * dx + dy * dy);
  return d > 0 ? { x: c.x + Math.trunc((dx * r) / d), y: c.y + Math.trunc((dy * r) / d) } : p;
}

/**
 * Past the leash: catch up at full speed. Inside it, a driving target is followed at
 * min(own, target) speed down to the GUARD_RETURN gap. A still target: stop once inside
 * GUARD_RETURN; the gap between the two limits stops stutter.
 */
function followGoal(u: Unit, o: GuardOrder, t: Unit): GuardGoal | undefined {
  const d = dist2(u.x, u.y, t.x, t.y);
  const back = leash(u, t, GUARD_RETURN), out = leash(u, t, GUARD_LEASH);
  if (o.chase && d <= back * back) o.chase = false;
  else if (!o.chase && d > out * out) o.chase = true;
  if (d > out * out) return { x: t.x, y: t.y };
  if (drives(t)) return d > back * back ? { x: t.x, y: t.y, speed: UNIT_STATS[t.kind].speed } : undefined;
  return o.chase ? { x: t.x, y: t.y } : undefined;
}

/**
 * True when `t`'s head order makes it drive this tick: a mobile unit on a move, a chasing guard,
 * or an attack or engage not holding in firing position.
 */
function drives(t: Unit): boolean {
  if (t.mode !== "mobile") return false;
  const o = head(t);
  return o?.type === "move"
    || (o?.type === "guard" && o.chase)
    || ((o?.type === "attack" || o?.type === "engage") && !o.hold);
}

/** A gap between the two hulls, as a centre distance. */
function leash(u: Unit, t: Unit, gap: number): number {
  return gap + UNIT_STATS[u.kind].radius + UNIT_STATS[t.kind].radius;
}

/** `p` pulled in to at most `r` from centre `c`. */
function clampToCircle(p: Point, c: Point, r: number): Point {
  const dx = p.x - c.x, dy = p.y - c.y;
  const d = isqrt(dx * dx + dy * dy);
  if (d <= r) return { x: p.x, y: p.y };
  return { x: c.x + Math.trunc((dx * r) / d), y: c.y + Math.trunc((dy * r) / d) };
}
