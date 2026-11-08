import { TERRAIN_MAX_HEIGHT } from "./stats.ts";
import { seaLevelOf } from "./terrain/water.ts";
import type { MapParams, Terrain } from "./types.ts";

/** Gentle hills from the seed. Integer heights in 0..TERRAIN_MAX_HEIGHT. */
export function generateTerrain(seed: number, params: MapParams): Terrain {
  const { cell } = params;
  const cols = params.width / cell + 1, rows = params.height / cell + 1;
  const raw: number[] = new Array(cols * rows);
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) raw[j * cols + i] = noiseAt(seed, i * cell, j * cell);
  }
  const heights = normalize(raw);
  return { cols, rows, cell, heights, seaLevel: seaLevelOf(heights) };
}

/** Ground height at (x, y), bilinear between vertices. Integer in, integer out; the client may pass floats. */
export function heightAt(t: Terrain, x: number, y: number): number {
  const c = t.cell;
  const cx = Math.min(Math.max(x, 0), (t.cols - 1) * c - 1);
  const cy = Math.min(Math.max(y, 0), (t.rows - 1) * c - 1);
  const ix = Math.floor(cx / c);
  const iy = Math.floor(cy / c);
  const fx = cx - ix * c;
  const fy = cy - iy * c;
  const i = iy * t.cols + ix;
  const h = t.heights;
  const top = h[i]! * (c - fx) + h[i + 1]! * fx;
  const bottom = h[i + t.cols]! * (c - fx) + h[i + t.cols + 1]! * fx;
  return Math.floor((top * (c - fy) + bottom * fy) / (c * c));
}

/** Value-noise octaves: lattice period in world units, and weight. Hills 4000, 2000 and 1000 across. */
const OCTAVES = [
  { period: 4000, weight: 4 },
  { period: 2000, weight: 2 },
  { period: 1000, weight: 1 },
] as const;
const ONE = 1024;

/** Noise at world position (x, y). */
function noiseAt(seed: number, x: number, y: number): number {
  let sum = 0;
  for (let o = 0; o < OCTAVES.length; o++) {
    const { period, weight } = OCTAVES[o]!;
    sum += octave(seed ^ Math.imul(o + 1, 0x9e3779b9), x, y, period) * weight;
  }
  return sum;
}

/** Smoothly interpolated lattice values, 0..ONE-1. */
function octave(seed: number, x: number, y: number, p: number): number {
  const gx = Math.floor(x / p), gy = Math.floor(y / p);
  const sx = smooth(x - gx * p, p), sy = smooth(y - gy * p, p);
  const top = lerp(lattice(seed, gx, gy), lattice(seed, gx + 1, gy), sx);
  const bottom = lerp(lattice(seed, gx, gy + 1), lattice(seed, gx + 1, gy + 1), sx);
  return lerp(top, bottom, sy);
}

/** Smoothstep 3t² − 2t³ of f/p, in 0..ONE. */
function smooth(f: number, p: number): number {
  const t = Math.floor((f * ONE) / p);
  return Math.floor((t * t * (3 * ONE - 2 * t)) / (ONE * ONE));
}

function lerp(a: number, b: number, s: number): number {
  return a + Math.floor(((b - a) * s) / ONE);
}

/** Integer hash of a lattice point, 0..ONE-1. */
function lattice(seed: number, x: number, y: number): number {
  let h = Math.imul(x, 0x27d4eb2d) ^ Math.imul(y, 0x165667b1) ^ seed;
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) & (ONE - 1);
}

function normalize(raw: readonly number[]): number[] {
  let lo = raw[0]!, hi = raw[0]!;
  for (const v of raw) {
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  const span = hi - lo || 1;
  return raw.map((v) => Math.floor(((v - lo) * TERRAIN_MAX_HEIGHT) / span));
}
