import { PROJ_FP, UNIT_STATS } from "./stats.ts";
import { angleOf, isqrt } from "./math.ts";
import { heightAt } from "./terrain.ts";
import { lowestClear, pitchSlope, solveArc, type Arc } from "./arc.ts";
import { muzzleTip } from "./muzzle.ts";
import type { Fp3 } from "./features/featureHit.ts";
import type { Projectile, Unit, World } from "./types.ts";

const MIN_FLIGHT = 12;
const DIRECT_SLACK = 5;
const BALLISTIC_SLACK = 20;

/** A shot `u` can fire: the arc, and the barrel tip it starts from (fixed point). */
export interface Firing { arc: Arc; from: Fp3 }

/** One weapon's arc from `from` to `t`, or undefined when it cannot reach. */
type Solve = (world: World, u: Unit, t: Unit, from: Fp3) => Arc | undefined;

/**
 * The ideal shot of `u`'s gun on `t`, its barrel turned to bear on `t`, or undefined when it cannot reach or `u` fires no shell.
 * Direct: the lowest arc to the target's middle that clears the terrain within `maxPitch`. Ballistic: the arc that lands on its ground.
 * The tip depends on the elevation and the elevation on the arc, so it iterates:
 * from the tip at rest (`gunRest`), it re-solves from the tip raised to the last arc's elevation
 * until the elevation settles (`AIM_SETTLE`) or `AIM_PASSES` runs out. The last solve is the plan.
 */
export function aim(world: World, u: Unit, t: Unit): Firing | undefined {
  const solve = solverOf(u);
  return solve && settle(world, u, t, pitchSlope(UNIT_STATS[u.kind].gunRest), solve);
}

/**
 * The shot from `u`'s barrel as it stands: turret at `bearing` angle steps, barrel at `slope` permille.
 * One solve from that tip to `t`; undefined when it cannot reach or `u` fires no shell.
 */
export function aimFrom(world: World, u: Unit, t: Unit, bearing: number, slope: number): Firing | undefined {
  const solve = solverOf(u);
  return solve && solveFrom(world, u, t, bearing, slope, solve);
}

function solverOf(u: Unit): Solve | undefined {
  const w = UNIT_STATS[u.kind].weapon;
  return w === "direct" ? solveDirect : w === "ballistic" ? solveBallistic : undefined;
}

/** Most solves `aim` runs before it takes the last one. */
const AIM_PASSES = 8;
/** Elevation change (permille) between passes small enough to stop. */
const AIM_SETTLE = 2;

/** Re-solve from the tip at the last arc's elevation until it settles; undefined if any pass cannot reach. */
function settle(world: World, u: Unit, t: Unit, slope: number, solve: Solve): Firing | undefined {
  let shot = solveAt(world, u, t, slope, solve);
  for (let pass = 1; shot && pass < AIM_PASSES; pass++) {
    if (Math.abs(shot.arc.elevation - slope) <= AIM_SETTLE) break;
    slope = shot.arc.elevation;
    shot = solveAt(world, u, t, slope, solve);
  }
  return shot;
}

/** Spawn a shell from `u` on `shot`, at its barrel tip. */
export function launch(world: World, u: Unit, shot: Firing, damage: number): void {
  const s = UNIT_STATS[u.kind];
  const { arc, from } = shot;
  const slack = s.weapon === "ballistic" ? BALLISTIC_SLACK : DIRECT_SLACK;
  const p: Projectile = {
    id: world.nextId++, owner: u.owner, shooter: u.id, source: u.kind,
    x: from.x, y: from.y, z: from.z,
    vx: arc.vx, vy: arc.vy, vz: arc.vz, damage, splash: s.splash, dig: s.dig, ttl: arc.flight + slack,
  };
  world.projectiles.push(p);
}

/** Solve from `u`'s barrel tip raised to `slope`, the barrel turned to bear on `t`. */
function solveAt(world: World, u: Unit, t: Unit, slope: number, solve: Solve): Firing | undefined {
  return solveFrom(world, u, t, angleOf(t.x - u.x, t.y - u.y, u.aim), slope, solve);
}

/** Solve from `u`'s barrel tip at `bearing` and `slope`. */
function solveFrom(world: World, u: Unit, t: Unit, bearing: number, slope: number, solve: Solve): Firing | undefined {
  const from = muzzleTip(u, world.terrain, bearing, slope);
  const arc = solve(world, u, t, from);
  return arc && { arc, from };
}

function solveDirect(world: World, u: Unit, t: Unit, from: Fp3): Arc | undefined {
  const s = UNIT_STATS[u.kind];
  const z = heightAt(world.terrain, t.x, t.y) + (UNIT_STATS[t.kind].height >> 1);
  const to = { x: t.x * PROJ_FP, y: t.y * PROJ_FP, z: z * PROJ_FP };
  return solveArc(world.terrain, from, to, s.shotSpeed, pitchSlope(s.maxPitch));
}

/**
 * Onto the target's ground point, in `max(MIN_FLIGHT, flat distance / shotSpeed)` ticks, or the first slower, higher lob that clears the terrain.
 * Undefined when a ridge blocks every lob.
 */
function solveBallistic(world: World, u: Unit, t: Unit, from: Fp3): Arc | undefined {
  const to = { x: t.x * PROJ_FP, y: t.y * PROJ_FP, z: heightAt(world.terrain, t.x, t.y) * PROJ_FP };
  const dx = to.x - from.x, dy = to.y - from.y;
  const lowest = Math.max(MIN_FLIGHT, Math.floor(isqrt(dx * dx + dy * dy) / (UNIT_STATS[u.kind].shotSpeed * PROJ_FP)));
  return lowestClear(world.terrain, from, to, lowest, Infinity);
}
