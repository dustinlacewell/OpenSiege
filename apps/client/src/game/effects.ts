import { heightAt, PROJ_FP, UNIT_STATS, type Unit, type World } from "@mf/sim";
import { DeathBlasts } from "./deathBlasts.ts";
import { explosion, muzzleFlash } from "./explosions.ts";
import type { PrevPose } from "./interp.ts";
import { LightPool } from "./lights.ts";
import { flashPoint } from "./muzzle.ts";
import { ParticlePool } from "./particles.ts";
import { ShotTracker, type ShotState } from "./shotTracker.ts";

const MUZZLE_SIZE = 0.5;

/** Client-only eye candy: explosions where shells vanish, muzzle flashes where units fire, and their lights. */
export class Effects {
  readonly pool = new ParticlePool();
  readonly lights = new LightPool();
  private readonly shots = new ShotTracker();
  private readonly blasts = new DeathBlasts();
  private world: World | null = null;
  private tick = 0;

  /** `prev` holds each unit's pose before the last step, as `Lockstep.prev` keeps it. */
  update(world: World, prev: ReadonlyMap<number, PrevPose>, dt: number): void {
    if (world !== this.world) this.reset(world);
    if (world.tick !== this.tick) this.onTicks(world, prev, world.tick - this.tick);
    this.pool.advance(dt, world.terrain);
    this.lights.advance(dt);
  }

  private reset(world: World): void {
    this.world = world;
    this.tick = world.tick;
    this.pool.clear();
    this.lights.clear();
    this.shots.clear();
    this.shots.observe(world.projectiles, () => {});
    this.blasts.skip(world.tick);
  }

  private onTicks(world: World, prev: ReadonlyMap<number, PrevPose>, elapsed: number): void {
    this.tick = world.tick;
    this.shots.observe(world.projectiles, (s) => this.explode(world, s));
    for (const b of this.blasts.take(world)) explosion(this.pool, this.lights, b.x, b.y, b.z, b.splash);
    for (const u of world.units) if (u.lastFired < elapsed) this.flash(world, u, prev.get(u.id));
  }

  /** At the shell's next position, but not below the ground. */
  private explode(world: World, s: ShotState): void {
    const x = (s.x + s.vx) / PROJ_FP;
    const y = (s.y + s.vy) / PROJ_FP;
    const z = Math.max(heightAt(world.terrain, x, y), (s.z + s.vz) / PROJ_FP);
    explosion(this.pool, this.lights, x, y, z, s.splash);
  }

  /** Where the shell left: the barrel tip at `u`'s pose before the step, `prev`. */
  private flash(world: World, u: Unit, prev: PrevPose | undefined): void {
    const length = UNIT_STATS[u.kind].gunLength;
    if (length <= 0) return;
    const tip = flashPoint(u, prev, world.terrain);
    muzzleFlash(this.pool, this.lights, tip.x, tip.y, tip.z, length * MUZZLE_SIZE);
  }
}
