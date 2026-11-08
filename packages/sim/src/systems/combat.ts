import { UNIT_STATS } from "../stats.ts";
import { angleDelta, angleOf, turnToward } from "../math.ts";
import { heightAt } from "../terrain.ts";
import { findUnit } from "../units.ts";
import { weaponOf, type Weapon } from "../weapons.ts";
import { nearestEnemy, reach, type Shot } from "../targeting.ts";
import { aim, aimFrom, launch, type Firing } from "../launch.ts";
import { canFire } from "../fireable.ts";
import { head } from "../orders.ts";
import { guardEnemy, guardedUnit } from "../guard.ts";
import { detectionFor, type Detection } from "../detection.ts";
import type { Grid } from "../grid.ts";
import type { Unit, World } from "../types.ts";

const LAST_FIRED_CAP = 255;
const TURN_RATE = 12;
/** Most angle steps the barrel may be off the bearing at the start of a tick and still fire: what the turret turns in one tick, so a fast crosser is not out-swept. */
const AIM_TOL = TURN_RATE;
/** Most permille the barrel may be off the planned elevation at the start of a tick and still fire. */
const ELEV_TOL = 60;

/** The barrel as the tick found it, which the client draws at the step's start. */
interface Barrel { aim: number; elevation: number }

/**
 * Tick weapon timers, pick targets, turn turrets and set elevations to the plan (`aim`).
 * Launch a shell when ready and the barrel was already on the plan: it leaves the tip the barrel had at the start of the tick.
 * Only an enemy the unit's team detects (`detectionFor`) is a target. A dead unit (hp 0, waiting for `deaths`) does nothing.
 */
export function combat(world: World, grid: Grid, seen: Detection): void {
  const near: number[] = [];
  for (const u of world.units) {
    if (u.hp <= 0) continue;
    tickTimers(u);
    const was: Barrel = { aim: u.aim, elevation: u.elevation };
    const w = weaponOf(u);
    const shot = w ? pickTarget(world, grid, detectionFor(u, seen), u, w, near) : undefined;
    const plan = shot && aim(world, u, shot.t);
    u.target = shot ? shot.t.id : 0;
    u.elevation = plan ? plan.arc.elevation : 0;
    const bearing = shot ? angleOf(shot.t.x - u.x, shot.t.y - u.y, u.aim) : u.facing;
    u.aim = turnToward(u.aim, bearing, TURN_RATE);
    if (!w || !shot) continue;
    if (UNIT_STATS[u.kind].weapon === "mine") u.hp = 0;
    else if (plan && ready(u, was, bearing, plan)) fireFrom(world, u, shot.t, was, w);
  }
}

function tickTimers(u: Unit): void {
  if (u.cooldown > 0) u.cooldown--;
  if (u.lastFired < LAST_FIRED_CAP) u.lastFired++;
}

/**
 * The attack or engage target if detected and in reach, else the guard's detected fireable enemy in reach,
 * else the nearest detected fireable enemy in reach. Reach honours `w.minRange`; fireable is `canFire`.
 */
function pickTarget(world: World, grid: Grid, seen: Detection, u: Unit, w: Weapon, near: number[]): Shot | undefined {
  const ground = heightAt(world.terrain, u.x, u.y);
  const fireable = (t: Unit) => canFire(world, u, t);
  return orderedTarget(world, seen, u, w, ground)
    ?? guardTarget(world, grid, seen, u, w, ground, near, fireable)
    ?? nearestEnemy(world, grid, seen, u, w.range, ground, near, 0, 0, fireable, w.minRange);
}

/** The head attack or engage order's target, if alive, detected and in reach. */
function orderedTarget(world: World, seen: Detection, u: Unit, w: Weapon, ground: number): Shot | undefined {
  const o = head(u);
  if (o?.type !== "attack" && o?.type !== "engage") return undefined;
  const t = findUnit(world, o.target);
  if (!t || t.hp <= 0 || !seen.detects(u.owner, t)) return undefined;
  const range = reach(world, u, t, w.range, ground, 0, w.minRange);
  return range === undefined ? undefined : { t, range };
}

/** A guard's first pick: the detected enemy nearest the unit it guards (`guard.ts`) that is in reach and passes `fireable`. */
function guardTarget(world: World, grid: Grid, seen: Detection, u: Unit, w: Weapon, ground: number, near: number[], fireable: (t: Unit) => boolean): Shot | undefined {
  const g = guardedUnit(world, u);
  if (!g) return undefined;
  const inReach = (t: Unit) => reach(world, u, t, w.range, ground, 0, w.minRange) !== undefined;
  const t = guardEnemy(world, grid, seen, u, g, near, (e) => inReach(e) && fireable(e));
  const range = t && reach(world, u, t, w.range, ground, 0, w.minRange);
  return t && range !== undefined ? { t, range } : undefined;
}

/** Reloaded, and the barrel `was` within `AIM_TOL` of the bearing and `ELEV_TOL` of the plan's elevation. */
function ready(u: Unit, was: Barrel, bearing: number, plan: Firing): boolean {
  return u.cooldown === 0
    && Math.abs(angleDelta(was.aim, bearing)) <= AIM_TOL
    && Math.abs(was.elevation - plan.arc.elevation) <= ELEV_TOL;
}

/** Fire on `t` from the tip of the barrel `was`, with an arc solved from that tip. No arc from there: hold fire. */
function fireFrom(world: World, u: Unit, t: Unit, was: Barrel, w: Weapon): void {
  const firing = aimFrom(world, u, t, was.aim, was.elevation);
  if (!firing) return;
  launch(world, u, firing, w.damage);
  u.cooldown = w.reload;
  u.lastFired = 0;
}
