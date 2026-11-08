import { GRAVITY, PROJ_FP, UNIT_STATS } from "../stats.ts";
import { dist2 } from "../math.ts";
import { heightAt } from "../terrain.ts";
import { substeps } from "../arc.ts";
import { MAX_RADIUS } from "../units.ts";
import { impact } from "../impact.ts";
import { detonate, NO_UNIT } from "../blast.ts";
import { featureHit, type Fp3 } from "../features/featureHit.ts";
import type { Grid } from "../grid.ts";
import type { SimState } from "../simState.ts";
import type { Feature, MapSize, Projectile, World } from "../types.ts";

/** Contact codes. A value >= 0 is the index of the unit hit. */
const FLYING = -1;
const OFF_MAP = -2;
const GROUND = -3;

/** The map edge in shell fixed-point units, per axis. */
interface Limit { x: number; y: number }

/** Buffers reused across shells. `prev` is where the shell was before the substep. */
interface Scratch { units: number[]; features: Feature[]; prev: Fp3 }

/** Fly every shell one tick in id order. Shells that hit or leave the map are removed. */
export function projectiles(state: SimState, grid: Grid, m: MapSize): void {
  const scratch: Scratch = { units: [], features: [], prev: { x: 0, y: 0, z: 0 } };
  // Death blasts queued last tick go off first, in queue order.
  for (const b of state.world.blasts) detonate(state, grid, b, NO_UNIT, null, scratch.units);
  state.world.blasts.length = 0;
  const limit = { x: m.width * PROJ_FP, y: m.height * PROJ_FP };
  const kept: Projectile[] = [];
  for (const p of state.world.projectiles) {
    if (fly(state, grid, p, scratch, limit)) kept.push(p);
  }
  state.world.projectiles = kept;
}

/** Move in even substeps, then apply gravity once. False when the shell is gone. */
function fly(state: SimState, grid: Grid, p: Projectile, s: Scratch, limit: Limit): boolean {
  const world = state.world;
  const direct = UNIT_STATS[p.source].weapon === "direct";
  const n = substeps(p.vx, p.vy);
  const x0 = p.x, y0 = p.y, z0 = p.z;
  s.prev.x = x0; s.prev.y = y0; s.prev.z = z0;
  for (let k = 1; k <= n; k++) {
    p.x = x0 + Math.trunc((p.vx * k) / n);
    p.y = y0 + Math.trunc((p.vy * k) / n);
    p.z = z0 + Math.trunc((p.vz * k) / n);
    const c = contact(world, grid, p, s.units, limit);
    if (c === OFF_MAP) return false;
    if (c !== FLYING) {
      impact(state, grid, p, c === GROUND ? NO_UNIT : c, null, s.units);
      return false;
    }
    // A direct shell stops at a rock or boulder it enters; an arc passes over.
    const struck = direct ? featureHit(state.features, world.terrain, s.prev, p, s.features) : null;
    if (struck) {
      impact(state, grid, p, NO_UNIT, struck, s.units);
      return false;
    }
    s.prev.x = p.x; s.prev.y = p.y; s.prev.z = p.z;
  }
  p.vz -= GRAVITY;
  if (--p.ttl > 0) return true;
  impact(state, grid, p, NO_UNIT, null, s.units);
  return false;
}

function contact(world: World, grid: Grid, p: Projectile, near: number[], limit: Limit): number {
  if (p.x < 0 || p.y < 0 || p.x > limit.x || p.y > limit.y) return OFF_MAP;
  const x = Math.floor(p.x / PROJ_FP), y = Math.floor(p.y / PROJ_FP);
  if (p.z <= heightAt(world.terrain, x, y) * PROJ_FP) return GROUND;
  return bodyAt(world, grid, p, x, y, near);
}

/** First unit (index order) whose body contains the shell, any owner but the shooter unit itself. */
function bodyAt(world: World, grid: Grid, p: Projectile, x: number, y: number, near: number[]): number {
  for (const i of grid.query(x, y, MAX_RADIUS, near)) {
    const t = world.units[i]!;
    if (t.id === p.shooter || t.hp <= 0) continue;
    const s = UNIT_STATS[t.kind];
    if (dist2(x, y, t.x, t.y) > s.radius * s.radius) continue;
    const ground = heightAt(world.terrain, t.x, t.y) * PROJ_FP;
    if (p.z >= ground && p.z <= ground + s.height * PROJ_FP) return i;
  }
  return FLYING;
}
