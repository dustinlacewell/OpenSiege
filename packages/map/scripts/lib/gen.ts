// Shared helpers for map generator scripts. Pure data in, `EditorMap` out; `finish` is the only I/O.
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { seaLevelOf, TERRAIN_MAX_HEIGHT } from "@mf/sim";
import { parseMap, placeField, scatterFeatures, serializeMap, type EditorMap, type Feature } from "../../src/index.ts";
import { writePng } from "./png.ts";

export type Pt = [number, number];
export type Transform = (p: Pt) => Pt;
export interface Size { W: number; H: number }

export const smooth = (t: number): number => { const c = Math.min(1, Math.max(0, t)); return c * c * (3 - 2 * c); };

const hash = (x: number, y: number): number => {
  let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

/** Smooth value noise in 0..1. `scale` is the lattice spacing in world units. */
export function noise(x: number, y: number, scale: number): number {
  const gx = x / scale, gy = y / scale, ix = Math.floor(gx), iy = Math.floor(gy), fx = smooth(gx - ix), fy = smooth(gy - iy);
  const a = hash(ix, iy), b = hash(ix + 1, iy), c = hash(ix, iy + 1), d = hash(ix + 1, iy + 1);
  return (a + (b - a) * fx) * (1 - fy) + (c + (d - c) * fx) * fy;
}

/** The identity and the 180 degree turn about the map centre. */
export const turn2 = ({ W, H }: Size): Transform[] => [(p) => p, ([x, y]) => [W - x, H - y]];

/** The four quarter turns about the centre. Square maps only, so integers stay integers. */
export function turn4({ W, H }: Size): Transform[] {
  if (W !== H) throw new Error("turn4 needs a square map");
  const c = W / 2;
  return [(p) => p, ([x, y]) => [c - (y - c), c + (x - c)], ([x, y]) => [W - x, H - y], ([x, y]) => [c + (y - c), c - (x - c)]];
}

export const orbit = (p: Pt, ts: Transform[]): Pt[] => ts.map((t) => t(p));

/** Fill the height grid from `raw`, averaged over the symmetry so the result is exactly symmetric. */
export function fillHeights(map: EditorMap, raw: (x: number, y: number) => number, ts: Transform[]): void {
  const { width, height, cell, heights } = map.spec;
  const cols = width / cell + 1, rows = height / cell + 1;
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    const sum = ts.reduce((s, t) => { const [x, y] = t([i * cell, j * cell]); return s + raw(x, y); }, 0);
    heights[j * cols + i] = Math.min(TERRAIN_MAX_HEIGHT, Math.max(0, Math.round(sum / ts.length)));
  }
}

/**
 * Pin the sea level for a dry map. The sim sets it to the lowest vertex plus `WATER_LEVEL`, so any map
 * has water somewhere. Sinking the corner vertices to 0 puts the sea at 60, below all real ground, and wets only those corners.
 */
export function sinkCorners(map: EditorMap, ts: Transform[]): void {
  const { width, height, cell, heights } = map.spec, cols = width / cell + 1;
  for (const [x, y] of orbit([0, 0], ts)) heights[(y / cell) * cols + x / cell] = 0;
}

/** Add a field at every image of each point. */
export function addFields(map: EditorMap, points: Pt[], radius: number, amount: number, ts: Transform[]): void {
  for (const p of points) for (const [x, y] of orbit(p, ts)) {
    const r = placeField(map.spec.fields, x, y, radius, amount, map.spec);
    if ("error" in r) throw new Error(`field ${x},${y}: ${r.error}`);
    map.spec.fields = r;
  }
}

export interface Scatter { kind: Feature["kind"]; x: number; y: number; radius: number; density: number }

/**
 * Scatter features, keep one per symmetry orbit, add the images. `keep` drops a feature
 * (for example one on a base or a field). An orbit whose own images crowd each other is dropped.
 */
export function scatterSymmetric(map: EditorMap, brushes: Scatter[], ts: Transform[], keep: (f: Feature) => boolean, seed = 1): void {
  let all: Feature[] = [];
  brushes.forEach((b, i) => { all = scatterFeatures(all, b.kind, b, b.density, seed * 1000 + i, map.spec); });
  const out: Feature[] = [];
  for (const f of all) {
    if (!keep(f) || !isCanonical(f, ts)) continue;
    const images = orbit([f.x, f.y], ts).map(([x, y]) => ({ ...f, x, y }));
    if (selfCrowded(images)) continue;
    out.push(...dedupe(images));
  }
  map.spec.features = [...map.spec.features, ...out];
}

const isCanonical = (f: Feature, ts: Transform[]): boolean =>
  orbit([f.x, f.y], ts).every(([x, y]) => x > f.x || (x === f.x && y >= f.y));

const dedupe = (fs: Feature[]): Feature[] => fs.filter((f, i) => fs.findIndex((g) => g.x === f.x && g.y === f.y) === i);

function selfCrowded(fs: Feature[]): boolean {
  const u = dedupe(fs);
  return u.some((a, i) => u.some((b, j) => i < j && Math.hypot(a.x - b.x, a.y - b.y) < (a.radius + b.radius) * 0.75));
}

/** Material weights, grass/dirt/rock/sand, any scale: they are normalised per vertex. */
export type Paint = (x: number, y: number, h: number) => [number, number, number, number];

export function paintMaterials(map: EditorMap, paint: Paint): void {
  const { width, height, cell, heights } = map.spec;
  const cols = width / cell + 1, rows = height / cell + 1, w = map.materials.weights;
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    const v = paint(i * cell, j * cell, heights[j * cols + i]!);
    const sum = v[0] + v[1] + v[2] + v[3] || 1;
    for (let c = 0; c < 4; c++) w[(j * cols + i) * 4 + c] = Math.round((v[c]! / sum) * 255);
  }
}

/** Height of the nearest vertex. */
export function groundAt(map: EditorMap, x: number, y: number): number {
  const { width, height, cell, heights } = map.spec, cols = width / cell + 1, rows = height / cell + 1;
  const i = Math.min(cols - 1, Math.max(0, Math.round(x / cell))), j = Math.min(rows - 1, Math.max(0, Math.round(y / cell)));
  return heights[j * cols + i]!;
}

/** The sim's sea level for this map: the lowest vertex plus `WATER_LEVEL`. Read it after `fillHeights`. */
export const seaOf = (map: EditorMap): number => seaLevelOf(map.spec.heights);

/** True when the ground is under the sea, or within `pad` units of height above it. */
export const wetAt = (map: EditorMap, x: number, y: number, pad = 0): boolean => groundAt(map, x, y) < seaOf(map) + pad;

/** Throws if any point is wet. Use it on bases and fields. */
export function assertDry(map: EditorMap, what: string, pts: Pt[], pad = 20): void {
  const wet = pts.filter(([x, y]) => wetAt(map, x, y, pad));
  if (wet.length > 0) throw new Error(`${what} in water at ${wet.map((p) => p.join(",")).join(" ")}; sea ${seaOf(map)}`);
}

/** Steepest drop to a neighbouring vertex, in height units per cell. The sim blocks a cell near 38% of the cell size. */
export function slopeAt(map: EditorMap, x: number, y: number): number {
  const c = map.spec.cell, h = groundAt(map, x, y);
  return Math.max(...[[c, 0], [-c, 0], [0, c], [0, -c], [c, c], [-c, -c]].map(([dx, dy]) => Math.abs(groundAt(map, x + dx!, y + dy!) - h))) / c * 100;
}

/** Throws if the ground inside a disc varies by more than `tolerance` height units. Use it on fields. */
export function assertFlat(map: EditorMap, what: string, discs: { x: number; y: number; radius: number }[], tolerance = 40): void {
  for (const { x, y, radius } of discs) {
    const hs: number[] = [];
    for (let a = 0; a < 16; a++) hs.push(groundAt(map, x + Math.cos(a / 16 * 2 * Math.PI) * radius, y + Math.sin(a / 16 * 2 * Math.PI) * radius));
    hs.push(groundAt(map, x, y));
    if (Math.max(...hs) - Math.min(...hs) > tolerance) throw new Error(`${what} at ${x},${y} is not flat: ${Math.min(...hs)}..${Math.max(...hs)}`);
  }
}

export interface Finish { file: string; marks: Pt[]; preview?: string }

/** The sim's `light` limit (`CLASS_PARAMS`): a cell is blocked when its corner heights differ by more than this percent of the cell. */
const MAX_GRADE = 38;

/**
 * Throws unless every point can be reached from the first on cells a `light` unit may enter. Slope only:
 * features and water are ignored, as water slows but does not block.
 */
export function assertConnected(map: EditorMap, what: string, pts: Pt[]): void {
  const { width, height, cell, heights } = map.spec, vc = width / cell + 1, nc = vc - 1, nr = height / cell;
  const open = (i: number, j: number): boolean => {
    const a = [heights[j * vc + i]!, heights[j * vc + i + 1]!, heights[(j + 1) * vc + i]!, heights[(j + 1) * vc + i + 1]!];
    return Math.floor(((Math.max(...a) - Math.min(...a)) * 100) / cell) <= MAX_GRADE;
  };
  const cellOf = ([x, y]: Pt): number => Math.min(nr - 1, Math.floor(y / cell)) * nc + Math.min(nc - 1, Math.floor(x / cell));
  const seen = new Uint8Array(nc * nr), stack = [cellOf(pts[0]!)];
  if (!open(stack[0]! % nc, Math.floor(stack[0]! / nc))) throw new Error(`${what}: start ${pts[0]} is on a blocked cell`);
  seen[stack[0]!] = 1;
  while (stack.length > 0) {
    const q = stack.pop()!, i = q % nc, j = Math.floor(q / nc);
    for (const [a, b] of [[i + 1, j], [i - 1, j], [i, j + 1], [i, j - 1]] as Pt[]) {
      if (a < 0 || b < 0 || a >= nc || b >= nr || seen[b * nc + a] || !open(a, b)) continue;
      seen[b * nc + a] = 1;
      stack.push(b * nc + a);
    }
  }
  const lost = pts.filter((p) => !seen[cellOf(p)]);
  if (lost.length > 0) throw new Error(`${what}: not reachable from ${pts[0]}: ${lost.map((p) => p.join(",")).join(" ")}`);
}

/** Check the map, write `maps/<file>.json` (or into `MAP_OUT_DIR`; `file` may name a subfolder), and optionally a top-down picture for the author. */
export function finish(map: EditorMap, o: Finish): void {
  assertConnected(map, o.file, [...o.marks, ...map.spec.fields.map((f): Pt => [f.x, f.y])]);
  const text = serializeMap(map);
  const check = parseMap(text);
  if ("errors" in check) throw new Error(check.errors.join("; "));
  const dir = process.env.MAP_OUT_DIR ?? fileURLToPath(new URL("../../../../maps/", import.meta.url));
  const out = `${dir}/${o.file}.json`;
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, text);
  const h = map.spec.heights;
  console.log(`${o.file}: ${map.spec.fields.length} fields, ${map.spec.features.length} features, heights ${Math.min(...h)}..${Math.max(...h)}`);
  if (o.preview) writePreview(map, o.marks, o.preview);
}

/** 1 px = 25 units. Fields are yellow rings, marks red dots, trees dark green, rocks grey. */
function writePreview(map: EditorMap, marks: Pt[], path: string): void {
  const { width: W, height: H, cell, heights } = map.spec, S = 25, pw = W / S, ph = H / S, cols = W / cell + 1, rows = H / cell + 1;
  const w = map.materials.weights, px = Buffer.alloc(pw * ph * 3), sea = seaOf(map);
  const vi = (x: number, y: number) => Math.min(rows - 1, Math.max(0, Math.round(y / cell))) * cols + Math.min(cols - 1, Math.max(0, Math.round(x / cell)));
  const cols3 = [[86, 130, 62], [121, 92, 62], [128, 128, 128], [214, 195, 140]];
  for (let y = 0; y < ph; y++) for (let x = 0; x < pw; x++) {
    const X = x * S, Y = y * S, o = vi(X, Y), h = heights[o]!, lit = 1 + (heights[vi(X - cell, Y - cell)]! - heights[vi(X + cell, Y + cell)]!) / 250;
    for (let c = 0; c < 3; c++) {
      let s = 0;
      for (let m = 0; m < 4; m++) s += w[o * 4 + m]! * cols3[m]![c]!;
      const ground = (s / 255) * lit * (0.7 + h / 1500);
      px[(y * pw + x) * 3 + c] = Math.min(255, h < sea ? ground * 0.35 + [10, 60, 110][c]! * (0.5 + (sea - h) / 120) : ground);
    }
  }
  const dot = (cx: number, cy: number, rad: number, col: number[], ring: boolean) => {
    for (let y = Math.floor((cy - rad) / S); y <= (cy + rad) / S; y++) for (let x = Math.floor((cx - rad) / S); x <= (cx + rad) / S; x++) {
      if (x < 0 || y < 0 || x >= pw || y >= ph) continue;
      const d = Math.hypot(x * S - cx, y * S - cy);
      if (d <= rad && (!ring || d > rad - S * 1.5)) col.forEach((v, c) => { px[(y * pw + x) * 3 + c] = v; });
    }
  };
  for (const f of map.spec.features) dot(f.x, f.y, f.radius, f.kind === "tree" ? [20, 70, 30] : [90, 90, 90], false);
  for (const f of map.spec.fields) dot(f.x, f.y, f.radius, [255, 220, 0], true);
  for (const [x, y] of marks) dot(x, y, 150, [230, 40, 40], false);
  writePng(path, pw, ph, px);
}
