import type { MapFeatureKind, MapSpec } from "@mf/sim";
import { MAX_FIELDS } from "@mf/sim";

export type Feature = MapSpec["features"][number];
export type Field = MapSpec["fields"][number];
export interface Bounds { width: number; height: number }
export interface Disc { x: number; y: number; radius: number }
export interface FeatureOpts { radius?: number; variant?: number }
export type Failed = { error: string };

/** Radius range of each kind. Copied from `packages/sim/src/features/place.ts` (RADIUS). Keep in step. */
const RADIUS: Record<MapFeatureKind, readonly [number, number]> = {
  tree: [50, 80],
  rock: [100, 190],
  boulder: [55, 90],
};

/** Two features may overlap by a quarter of their combined radii. Percent of the sum, as `PACK_PCT` in place.ts. */
const PACK_PCT = 75;

const DEFAULT_FIELD_AMOUNT = 5000;

/** Add one feature. Radius defaults to the middle of the kind's range. The centre is clamped onto the map. */
export function placeFeature(features: readonly Feature[], kind: MapFeatureKind, x: number, y: number, opts: FeatureOpts | undefined, map: Bounds): Feature[] {
  const [lo, hi] = RADIUS[kind];
  const radius = Math.round(opts?.radius ?? (lo + hi) / 2);
  const variant = Math.round(opts?.variant ?? 0);
  const f: Feature = { kind, x: clampInt(x, map.width), y: clampInt(y, map.height), radius, variant };
  return [...features, f];
}

/**
 * Add random features of one kind inside the brush disc. `density` is features per 1e6 square units.
 * Same inputs, same result. A point that crowds a feature or leaves the map is dropped, not retried.
 */
export function scatterFeatures(features: readonly Feature[], kind: MapFeatureKind, brush: Disc, density: number, seed: number, map: Bounds): Feature[] {
  const rand = mulberry32(seed);
  const [lo, hi] = RADIUS[kind];
  const tries = Math.floor((density * Math.PI * brush.radius * brush.radius) / 1e6);
  const out = [...features];
  for (let i = 0; i < tries; i++) {
    const a = rand() * 2 * Math.PI, d = Math.sqrt(rand()) * brush.radius;
    const x = Math.round(brush.x + Math.cos(a) * d), y = Math.round(brush.y + Math.sin(a) * d);
    const radius = lo + Math.floor(rand() * (hi - lo + 1));
    const variant = Math.floor(rand() * 4);
    if (x < 0 || y < 0 || x > map.width || y > map.height) continue;
    if (crowded(out, x, y, radius)) continue;
    out.push({ kind, x, y, radius, variant });
  }
  return out;
}

/** Remove features whose centre lies in the brush disc. With `kind`, only that kind. */
export function eraseFeatures(features: readonly Feature[], brush: Disc, kind?: MapFeatureKind): { features: Feature[]; removed: Feature[] } {
  const kept: Feature[] = [], removed: Feature[] = [];
  const r2 = brush.radius * brush.radius;
  for (const f of features) {
    const hit = (kind === undefined || f.kind === kind) && dist2(f.x, f.y, brush.x, brush.y) <= r2;
    (hit ? removed : kept).push(f);
  }
  return { features: kept, removed };
}

/** Add a resource field. Fails past the cap, under radius 1, or if the disc is not wholly on the map. */
export function placeField(fields: readonly Field[], x: number, y: number, radius: number, amount: number | undefined, map: Bounds): Field[] | Failed {
  if (fields.length >= MAX_FIELDS) return { error: `at most ${MAX_FIELDS} fields` };
  const bad = fieldError(x, y, radius, map);
  if (bad) return { error: bad };
  return [...fields, { x, y, radius, amount: amount ?? DEFAULT_FIELD_AMOUNT }];
}

export function moveField(fields: readonly Field[], index: number, x: number, y: number, map: Bounds): Field[] | Failed {
  const f = fields[index];
  if (!f) return { error: `no field ${index}` };
  const bad = fieldError(x, y, f.radius, map);
  return bad ? { error: bad } : replaceAt(fields, index, { ...f, x, y });
}

export function resizeField(fields: readonly Field[], index: number, radius: number, map: Bounds): Field[] | Failed {
  const f = fields[index];
  if (!f) return { error: `no field ${index}` };
  const bad = fieldError(f.x, f.y, radius, map);
  return bad ? { error: bad } : replaceAt(fields, index, { ...f, radius });
}

export function removeField(fields: readonly Field[], index: number): Field[] {
  return fields.filter((_, i) => i !== index);
}

/** Why a field of this shape cannot stand here, or undefined if it can. */
function fieldError(x: number, y: number, radius: number, map: Bounds): string | undefined {
  if (![x, y, radius].every(Number.isInteger)) return "x, y and radius must be integers";
  if (radius < 1) return "radius under 1";
  if (x < radius || y < radius || x > map.width - radius || y > map.height - radius) return "field is not wholly on the map";
  return undefined;
}

function replaceAt(fields: readonly Field[], index: number, f: Field): Field[] {
  return fields.map((g, i) => (i === index ? f : g));
}

function crowded(features: readonly Feature[], x: number, y: number, radius: number): boolean {
  return features.some((f) => dist2(x, y, f.x, f.y) * 10000 < ((f.radius + radius) * PACK_PCT) ** 2);
}

const dist2 = (ax: number, ay: number, bx: number, by: number): number => (ax - bx) ** 2 + (ay - by) ** 2;

function clampInt(v: number, max: number): number {
  return Math.min(max, Math.max(0, Math.round(v)));
}

/** Small seeded generator: uint32 state, floats in [0, 1). */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
