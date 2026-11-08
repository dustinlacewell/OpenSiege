import { heightAt, inWater, PROJ_FP, TICK_MS, UNIT_STATS, type Terrain, type Unit, type World } from "@mf/sim";
import { DeathBlasts } from "./deathBlasts.ts";
import { lerp, type PrevPose } from "./interp.ts";
import { ShotTracker, type ShotState } from "./shotTracker.ts";

/** Water height added per second at a wake's centre, per world unit per second of speed. */
export const WAKE_HEIGHT = 0.06;
/** Foam added per second at a wake's centre, per world unit per second of speed. */
export const WAKE_FOAM = 0.02;
/** Below this speed (world units per second) a unit leaves no wake. */
export const WAKE_MIN_SPEED = 5;
/** A splash pushes the water down by this fraction of its radius, at most SPLASH_MAX_DEPTH. */
export const SPLASH_DEPTH = 0.3;
export const SPLASH_MAX_DEPTH = 60;
/** Smallest splash radius, world units. Same floor as the smoke burst. */
export const SPLASH_MIN_RADIUS = 30;

/** What the local player sees. `Vision` satisfies it. */
export interface RippleSight {
  sees(x: number, y: number): boolean;
  shows(u: Unit): boolean;
}

/** Receives one gaussian splat: centre, radius (world units), height added at the centre (world units), foam added at the centre. */
export interface SplatSink {
  splat(x: number, y: number, radius: number, height: number, foam: number): void;
}

const TICK_SECONDS = TICK_MS / 1000;

/**
 * Turns the world into water impulses for the ripple field, once per frame.
 * Wakes: every seen unit whose drawn centre is in water and moving. Splashes: every seen shell burst
 * and death blast that lands in water, each once.
 */
export class RippleSources {
  private readonly shots = new ShotTracker();
  private readonly blasts = new DeathBlasts();
  private readonly onGone = (s: ShotState) => this.shellSplash(s);
  private world: World | null = null;
  private tick = 0;
  private sight: RippleSight | null = null;
  private sink: SplatSink | null = null;

  /** `dt` is the frame's seconds; wakes scale by it. */
  collect(world: World, prev: ReadonlyMap<number, PrevPose>, alpha: number, dt: number, sight: RippleSight, sink: SplatSink): void {
    this.sight = sight;
    this.sink = sink;
    if (world !== this.world) this.reset(world);
    else if (world.tick !== this.tick) this.onTick(world);
    emitWakes(world, prev, alpha, dt, sight, sink);
  }

  private reset(world: World): void {
    this.world = world;
    this.tick = world.tick;
    this.shots.clear();
    this.shots.observe(world.projectiles, () => {});
    this.blasts.skip(world.tick);
  }

  private onTick(world: World): void {
    this.tick = world.tick;
    this.shots.observe(world.projectiles, this.onGone);
    for (const b of this.blasts.take(world)) emitSplash(world.terrain, b.x, b.y, b.z, b.splash, this.sight!, this.sink!);
  }

  /** At the shell's next position, as the explosion and smoke place it. */
  private shellSplash(s: ShotState): void {
    const x = (s.x + s.vx) / PROJ_FP;
    const y = (s.y + s.vy) / PROJ_FP;
    emitSplash(this.world!.terrain, x, y, (s.z + s.vz) / PROJ_FP, s.splash, this.sight!, this.sink!);
  }
}

/** Pure. One splat per seen unit whose interpolated centre is in water and moves faster than WAKE_MIN_SPEED. */
export function emitWakes(
  world: World, prev: ReadonlyMap<number, PrevPose>, alpha: number, dt: number, sight: RippleSight, sink: SplatSink,
): void {
  if (dt <= 0) return;
  const a = Math.min(1, Math.max(0, alpha));
  for (const u of world.units) {
    const p = prev.get(u.id);
    if (!p || !sight.shows(u)) continue;
    const speed = Math.hypot(u.x - p.x, u.y - p.y) / TICK_SECONDS;
    if (speed < WAKE_MIN_SPEED) continue;
    const x = lerp(p.x, u.x, a);
    const y = lerp(p.y, u.y, a);
    if (!inWater(world.terrain, x, y)) continue;
    const r = UNIT_STATS[u.kind].radius;
    const size = r / 50;
    sink.splat(x, y, r, -WAKE_HEIGHT * speed * size * dt, Math.min(1, WAKE_FOAM * speed * dt));
  }
}

/** Pure. A splash ring for a burst at (x, y, z) of radius `splash`, if it is seen, in water, and not high in the air. */
export function emitSplash(terrain: Terrain, x: number, y: number, z: number, splash: number, sight: RippleSight, sink: SplatSink): void {
  const radius = Math.max(SPLASH_MIN_RADIUS, splash);
  if (!inWater(terrain, x, y)) return;
  const surface = Math.max(heightAt(terrain, x, y), terrain.seaLevel);
  if (z - surface > radius * 0.5) return;
  if (!sight.sees(x, y)) return;
  sink.splat(x, y, radius, -Math.min(SPLASH_MAX_DEPTH, radius * SPLASH_DEPTH), 1);
}
