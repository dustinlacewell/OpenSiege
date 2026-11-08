import { dist2 } from "./math.ts";
import { heightAt } from "./terrain.ts";
import { effectiveRange, maxRange } from "./weapons.ts";
import { isEnemy } from "./teams.ts";
import type { Detection } from "./detection.ts";
import type { Grid } from "./grid.ts";
import type { Unit, World } from "./types.ts";

// The one target query. Orders and weapons both ask it, so "in range" has one meaning, height included.
// Only an enemy the shooter's team detects (`detection.ts`) can be picked or counted.

/** A target and the effective range that reaches it. */
export interface Shot { t: Unit; range: number }

/** Effective range of weapon base range `base` from a shooter on `ground` to `t`. */
export function rangeTo(world: World, t: Unit, base: number, ground: number): number {
  return effectiveRange(base, ground, heightAt(world.terrain, t.x, t.y));
}

/**
 * The effective range to `t` when `t` is within it plus `extra` and no nearer than `min`, else undefined.
 * `ground` is the height under `u`. `min` is the weapon's `minRange`; 0 for a query that is not a weapon pick.
 */
export function reach(world: World, u: Unit, t: Unit, base: number, ground: number, extra = 0, min = 0): number | undefined {
  const range = rangeTo(world, t, base, ground);
  const r = range + extra;
  const d = dist2(u.x, u.y, t.x, t.y);
  return d <= r * r && d >= min * min ? range : undefined;
}

/**
 * The living enemy of `u` that `seen` detects, nearest it within effective range plus `extra`, ignoring id `skip` (0 = none).
 * Ties go to the first found. `grid` is the `before` grid; `near` is a scratch buffer.
 * `accept`, when given, must pass too; it runs only for an enemy nearer than the best so far.
 * An enemy nearer than `min` (the weapon's `minRange`) is skipped.
 */
export function nearestEnemy(world: World, grid: Grid, seen: Detection, u: Unit, base: number, ground: number, near: number[], extra = 0, skip = 0, accept?: (t: Unit) => boolean, min = 0): Shot | undefined {
  let best: Shot | undefined;
  let bestD = Number.MAX_SAFE_INTEGER;
  for (const i of grid.query(u.x, u.y, maxRange(base) + extra, near)) {
    const t = world.units[i]!;
    if (t.id === skip || !detectedEnemy(world, seen, u, t)) continue;
    const d = dist2(u.x, u.y, t.x, t.y);
    if (d >= bestD) continue;
    const range = reach(world, u, t, base, ground, extra, min);
    if (range !== undefined && (!accept || accept(t))) { bestD = d; best = { t, range }; }
  }
  return best;
}

/**
 * Like `nearestEnemy`, but picks the enemy with the most detected enemies within `blast` of it (itself included),
 * for a blast that hurts crowds. A tie in count goes to the nearer enemy, then the first found.
 */
export function densestEnemy(world: World, grid: Grid, seen: Detection, u: Unit, base: number, ground: number, near: number[], blast: number, extra = 0, skip = 0, min = 0): Shot | undefined {
  let best: Shot | undefined;
  let bestCount = 0;
  let bestD = Number.MAX_SAFE_INTEGER;
  const crowd: number[] = [];
  for (const i of grid.query(u.x, u.y, maxRange(base) + extra, near)) {
    const t = world.units[i]!;
    if (t.id === skip || !detectedEnemy(world, seen, u, t)) continue;
    const range = reach(world, u, t, base, ground, extra, min);
    if (range === undefined) continue;
    const d = dist2(u.x, u.y, t.x, t.y);
    const count = enemiesAround(world, grid, seen, u, t, blast, crowd);
    if (count > bestCount || (count === bestCount && d < bestD)) { bestCount = count; bestD = d; best = { t, range }; }
  }
  return best;
}

/** Living detected enemies of `u` within `radius` of `at`, `at` included. */
function enemiesAround(world: World, grid: Grid, seen: Detection, u: Unit, at: Unit, radius: number, scratch: number[]): number {
  let n = 0;
  for (const i of grid.query(at.x, at.y, radius, scratch)) {
    const t = world.units[i]!;
    if (detectedEnemy(world, seen, u, t) && dist2(at.x, at.y, t.x, t.y) < radius * radius) n++;
  }
  return n;
}

/** `t` is alive, an enemy of `u`, and detected by `u`'s team. */
function detectedEnemy(world: World, seen: Detection, u: Unit, t: Unit): boolean {
  return t.hp > 0 && isEnemy(world.players, u.owner, t.owner) && seen.detects(u.owner, t);
}

/** The distance a closing unit stops at: one eighth inside `range`, so the hull holds in a dead band. */
export function holdRange(range: number): number {
  return range - Math.floor(range / 8);
}
