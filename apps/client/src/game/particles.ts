import { heightAt, type Terrain } from "@mf/sim";

/** GLOW: camera-facing soft light. RING: flat ring on the ground that expands. SPARK: small falling glow. */
export const GLOW = 0;
export const RING = 1;
export const SPARK = 2;

export interface Particle {
  kind: number;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  /** Seconds. */
  age: number;
  life: number;
  /** World units: the start size for GLOW and SPARK, the final radius for RING. */
  size: number;
  r: number;
  g: number;
  b: number;
  /** World units per second² pulled down. */
  gravity: number;
}

/** A pool of particles. `items[0..count)` are alive; dead ones are swapped out and reused. */
export class ParticlePool {
  readonly items: Particle[] = [];
  count = 0;

  spawn(kind: number, x: number, y: number, z: number, life: number, size: number, rgb: readonly number[]): Particle {
    let p = this.items[this.count];
    if (!p) {
      p = { kind: 0, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, age: 0, life: 1, size: 1, r: 1, g: 1, b: 1, gravity: 0 };
      this.items.push(p);
    }
    this.count++;
    p.kind = kind;
    p.x = x; p.y = y; p.z = z;
    p.vx = 0; p.vy = 0; p.vz = 0;
    p.age = 0; p.life = life; p.size = size; p.gravity = 0;
    p.r = rgb[0]!; p.g = rgb[1]!; p.b = rgb[2]!;
    return p;
  }

  /** Ages and moves every particle; drops the expired. Sparks stop on the ground. */
  advance(dt: number, terrain: Terrain): void {
    let i = 0;
    while (i < this.count) {
      const p = this.items[i]!;
      p.age += dt;
      if (p.age >= p.life) {
        this.remove(i);
        continue;
      }
      move(p, dt, terrain);
      i++;
    }
  }

  clear(): void {
    this.count = 0;
  }

  private remove(i: number): void {
    const last = this.count - 1;
    const items = this.items;
    const dead = items[i]!;
    items[i] = items[last]!;
    items[last] = dead;
    this.count = last;
  }
}

function move(p: Particle, dt: number, terrain: Terrain): void {
  p.vz -= p.gravity * dt;
  p.x += p.vx * dt;
  p.y += p.vy * dt;
  p.z += p.vz * dt;
  if (p.gravity === 0) return;
  const ground = heightAt(terrain, p.x, p.y);
  if (p.z >= ground) return;
  p.z = ground;
  p.vx *= 0.4;
  p.vy *= 0.4;
  p.vz = Math.abs(p.vz) * 0.25;
}
