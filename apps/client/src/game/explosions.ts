import type { LightPool } from "./lights.ts";
import { GLOW, RING, SPARK, type ParticlePool } from "./particles.ts";

const FLASH_RGB = [1.0, 0.72, 0.35] as const;
const RING_RGB = [1.0, 0.55, 0.25] as const;
const SPARK_RGB = [1.0, 0.82, 0.45] as const;
const MUZZLE_RGB = [1.0, 0.88, 0.55] as const;
const SPARK_GRAVITY = 900;
/** Linear radiance of the light an explosion and a muzzle flash cast. */
const BLAST_LIGHT_RGB = [6.0, 4.6, 2.9] as const;
const MUZZLE_LIGHT_RGB = [4.0, 3.3, 2.0] as const;

/** Flash, ground ring and debris sparks, all scaled by the splash radius, and a light on what is near. */
export function explosion(pool: ParticlePool, lights: LightPool, x: number, y: number, z: number, splash: number): void {
  const s = Math.max(30, splash);
  lights.spawn(x, y, z + s * 0.25, s * 3, BLAST_LIGHT_RGB, 0.45, "decay");
  pool.spawn(GLOW, x, y, z + s * 0.25, 0.28, s * 0.9, FLASH_RGB);
  pool.spawn(GLOW, x, y, z + s * 0.15, 0.12, s * 1.4, MUZZLE_RGB);
  pool.spawn(RING, x, y, z + 2, 0.5, s * 1.3, RING_RGB);
  const sparks = 4 + Math.round(s / 20);
  for (let i = 0; i < sparks; i++) spark(pool, x, y, z + 4, 150 + s * 2);
}

/** A short bright flash at a barrel tip, and a small light. */
export function muzzleFlash(pool: ParticlePool, lights: LightPool, x: number, y: number, z: number, size: number): void {
  lights.spawn(x, y, z, size * 4, MUZZLE_LIGHT_RGB, 0.1, "hold");
  pool.spawn(GLOW, x, y, z, 0.12, size, MUZZLE_RGB);
}

function spark(pool: ParticlePool, x: number, y: number, z: number, speed: number): void {
  const p = pool.spawn(SPARK, x, y, z, 0.5 + Math.random() * 0.5, 6 + Math.random() * 6, SPARK_RGB);
  const a = Math.random() * Math.PI * 2;
  const out = speed * (0.4 + Math.random() * 0.6);
  p.vx = Math.cos(a) * out;
  p.vy = Math.sin(a) * out;
  p.vz = speed * (0.6 + Math.random() * 0.8);
  p.gravity = SPARK_GRAVITY;
}
