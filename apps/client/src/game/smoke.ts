import { heightAt, PROJ_FP, UNIT_STATS, type Projectile, type World } from "@mf/sim";
import { DecalStamps } from "./decalStamps.ts";
import { ShotTracker, type ShotState } from "./shotTracker.ts";

/** A camera-facing smoke cloud that rises, grows and fades. */
export interface Puff {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  /** Seconds. */
  age: number;
  life: number;
  /** Start radius in world units; it grows to `size · grow`. */
  size: number;
  grow: number;
  /** sRGB grey of the smoke. */
  shade: number;
  /** 0..1, picks the noise pattern and rotation. */
  seed: number;
}

const MAX_DT = 0.1;
const MAX_PUFFS = 6000;
const DRAG = 0.7;

/** Client-only smoke: clouds where shells land, a thin trail behind artillery shells, scorch stamps for ground bursts. */
export class SmokeField {
  readonly items: Puff[] = [];
  count = 0;
  /** Scorches of ground bursts, waiting for the decal map. */
  readonly stamps = new DecalStamps();
  private readonly shots = new ShotTracker();
  private readonly onGone = (s: ShotState) => this.impact(s);
  private world: World | null = null;
  private tick = 0;
  private time = -1;

  /** Call once per frame. `time` in seconds. */
  update(world: World, time: number): void {
    const dt = this.time < 0 ? 0 : Math.min(MAX_DT, Math.max(0, time - this.time));
    this.time = time;
    if (world !== this.world) this.reset(world);
    else if (world.tick !== this.tick) this.onTick(world);
    this.advance(dt);
  }

  private reset(world: World): void {
    this.world = world;
    this.tick = world.tick;
    this.count = 0;
    this.stamps.clear();
    this.shots.clear();
    this.shots.observe(world.projectiles, () => {});
  }

  private onTick(world: World): void {
    this.tick = world.tick;
    this.shots.observe(world.projectiles, this.onGone);
    for (const s of world.projectiles) if (UNIT_STATS[s.source].weapon === "ballistic") this.trail(s);
  }

  private impact(s: ShotState): void {
    const t = this.world!.terrain;
    const x = (s.x + s.vx) / PROJ_FP;
    const y = (s.y + s.vy) / PROJ_FP;
    const ground = heightAt(t, x, y);
    const z = Math.max(ground, (s.z + s.vz) / PROJ_FP);
    const splash = Math.max(30, s.splash);
    const n = Math.min(7, 2 + Math.round(splash / 45));
    for (let i = 0; i < n; i++) this.cloud(x, y, z, splash);
    if (z - ground < splash * 0.5) this.stamps.push({ x, y, radius: splash * 0.9, seed: Math.random() });
  }

  private cloud(x: number, y: number, z: number, splash: number): void {
    const a = Math.random() * Math.PI * 2;
    const r = Math.random() * splash * 0.35;
    const p = this.spawn(x + Math.cos(a) * r, y + Math.sin(a) * r, z + splash * 0.1);
    if (!p) return;
    p.vx = Math.cos(a) * (10 + Math.random() * 20);
    p.vy = Math.sin(a) * (10 + Math.random() * 20);
    p.vz = 25 + Math.random() * 35;
    p.life = 2.5 + Math.random() * 2;
    p.size = splash * (0.3 + Math.random() * 0.2);
    p.grow = 1.8 + Math.random() * 0.8;
    p.shade = 0.28 + Math.random() * 0.18;
  }

  private trail(s: Projectile): void {
    const p = this.spawn(s.x / PROJ_FP, s.y / PROJ_FP, s.z / PROJ_FP);
    if (!p) return;
    p.vz = 8;
    p.life = 1.2 + Math.random() * 0.4;
    p.size = 7;
    p.grow = 2.5;
    p.shade = 0.6;
  }

  private spawn(x: number, y: number, z: number): Puff | null {
    if (this.count >= MAX_PUFFS) return null;
    let p = this.items[this.count];
    if (!p) {
      p = { x, y, z, vx: 0, vy: 0, vz: 0, age: 0, life: 1, size: 1, grow: 1, shade: 0.3, seed: 0 };
      this.items.push(p);
    }
    this.count++;
    p.x = x; p.y = y; p.z = z;
    p.vx = 0; p.vy = 0; p.vz = 0;
    p.age = 0;
    p.seed = Math.random();
    return p;
  }

  private advance(dt: number): void {
    const drag = Math.exp(-dt * DRAG);
    let i = 0;
    while (i < this.count) {
      const p = this.items[i]!;
      p.age += dt;
      if (p.age >= p.life) {
        this.remove(i);
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      p.vx *= drag;
      p.vy *= drag;
      i++;
    }
  }

  private remove(i: number): void {
    const last = this.count - 1;
    const dead = this.items[i]!;
    this.items[i] = this.items[last]!;
    this.items[last] = dead;
    this.count = last;
  }
}
