import { GRAVITY, PROJ_FP } from "./stats.ts";
import { isqrt } from "./math.ts";
import { heightAt } from "./terrain.ts";
import type { Fp3 } from "./features/featureHit.ts";
import type { Terrain } from "./types.ts";

// Shell flight solutions. Per tick a shell moves pos += vel in even substeps, then vz -= GRAVITY (`systems/projectiles.ts`).

/** Longest move of one shell substep along the ground, fixed point. */
export const MAX_SUBSTEP = 25 * PROJ_FP;
/** Slower flights tried after the lowest arc, in quarters of its flight time: 5/4 up to 12/4. */
const SLOWER_STEPS = 8;

/** A launch solution: fixed-point velocity, flight time, and gun elevation as slope in permille (rise per 1000 run). */
export interface Arc { vx: number; vy: number; vz: number; flight: number; elevation: number }

/**
 * Slope in permille of each whole degree 0..89. A one-time table built at module load, so the sim never calls trig per tick.
 * Rounded to integers, so every engine builds the same table.
 */
const SLOPES: readonly number[] = Array.from({ length: 90 }, (_, d) => Math.round(Math.tan((d * Math.PI) / 180) * 1000));

/** Slope in permille of an elevation of `deg` whole degrees, clamped to 0..89. */
export function pitchSlope(deg: number): number {
  return SLOPES[Math.min(Math.max(Math.trunc(deg), 0), SLOPES.length - 1)]!;
}

/**
 * The lowest arc from `from` to `to` (fixed point) at `speed` world units per tick along the ground
 * that rises no steeper than `maxSlope` permille and clears the terrain. Undefined when none does.
 */
export function solveArc(terrain: Terrain, from: Fp3, to: Fp3, speed: number, maxSlope: number): Arc | undefined {
  const dx = to.x - from.x, dy = to.y - from.y;
  const lowest = Math.max(1, Math.ceil(isqrt(dx * dx + dy * dy) / (speed * PROJ_FP)));
  return lowestClear(terrain, from, to, lowest, maxSlope);
}

/**
 * The first arc from `from` to `to` that rises no steeper than `maxSlope` and clears the terrain,
 * tried at flights of `lowest` ticks, then slower and so higher. Undefined when none does.
 */
export function lowestClear(terrain: Terrain, from: Fp3, to: Fp3, lowest: number, maxSlope: number): Arc | undefined {
  const dx = to.x - from.x, dy = to.y - from.y, dz = to.z - from.z;
  let tried = 0;
  for (let i = 0; i <= SLOWER_STEPS; i++) {
    const flight = Math.ceil((lowest * (4 + i)) / 4);
    if (flight === tried) continue;
    tried = flight;
    const arc = arcOver(dx, dy, dz, flight);
    if (arc.elevation <= maxSlope && arcClear(terrain, from, arc)) return arc;
  }
  return undefined;
}

/** The arc that covers (dx, dy, dz) in exactly `flight` ticks. */
export function arcOver(dx: number, dy: number, dz: number, flight: number): Arc {
  const vx = Math.trunc(dx / flight), vy = Math.trunc(dy / flight);
  const vz = Math.floor((dz + (GRAVITY * flight * (flight - 1)) / 2) / flight);
  const run = isqrt(vx * vx + vy * vy);
  const elevation = run > 0 ? Math.trunc((vz * 1000) / run) : 0;
  return { vx, vy, vz, flight, elevation };
}

/**
 * True when a shell launched at `from` on `arc` stays above the ground for its whole flight.
 * Replays `fly` substep by substep. Skips the very last substep: the arrival point is the aim point itself.
 */
export function arcClear(terrain: Terrain, from: Fp3, arc: Arc): boolean {
  const n = substeps(arc.vx, arc.vy);
  let x = from.x, y = from.y, z = from.z, vz = arc.vz;
  for (let t = 1; t <= arc.flight; t++) {
    const last = t === arc.flight ? n - 1 : n;
    for (let k = 1; k <= last; k++) {
      const px = x + Math.trunc((arc.vx * k) / n), py = y + Math.trunc((arc.vy * k) / n);
      if (z + Math.trunc((vz * k) / n) <= groundAt(terrain, px, py)) return false;
    }
    x += arc.vx; y += arc.vy; z += vz;
    vz -= GRAVITY;
  }
  return true;
}

/** Enough substeps that none moves more than MAX_SUBSTEP along the ground. */
export function substeps(vx: number, vy: number): number {
  return Math.max(1, Math.ceil(isqrt(vx * vx + vy * vy) / MAX_SUBSTEP));
}

/** Ground height under a fixed-point point, in fixed point. The same test as a shell's ground contact. */
function groundAt(terrain: Terrain, x: number, y: number): number {
  return heightAt(terrain, Math.floor(x / PROJ_FP), Math.floor(y / PROJ_FP)) * PROJ_FP;
}
