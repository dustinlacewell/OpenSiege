import { MAX_FIELDS, TERRAIN_MAX_HEIGHT } from "./stats.ts";
import type { MapParams, MapSize, MapSpec, Terrain } from "./types.ts";

/** Grid lines, the unit grid and the nav grid all share this spacing, so `cell` must divide it. */
const LINE_SPACING = 1000;
/**
 * Most vertices a map may have, and most cells along one side. Keeps the A* heap key under 2^53 (`nav/astar.ts`)
 * and the render mesh, 16 vertices per map vertex, to a few million.
 */
const MAX_VERTICES = 1 << 18;
const MAX_SIDE_CELLS = 2048;

export const mapWidth = (t: Terrain): number => (t.cols - 1) * t.cell;
export const mapHeight = (t: Terrain): number => (t.rows - 1) * t.cell;
export const mapSize = (t: Terrain): MapSize => ({ width: mapWidth(t), height: mapHeight(t) });

export const clampX = (m: MapSize, v: number): number => (v < 0 ? 0 : v > m.width ? m.width : v);
export const clampY = (m: MapSize, v: number): number => (v < 0 ? 0 : v > m.height ? m.height : v);

/** For AI and client only. Never in sim state or `step`: hypot is not bit-exact across machines. */
export const mapDiagonal = (m: MapSize): number => Math.hypot(m.width, m.height);
export const mapCentre = (m: MapSize): { x: number; y: number } => ({ x: m.width >> 1, y: m.height >> 1 });

/** Margin for spawn picks and edge placement: at most 1000, and at most an eighth of the short side. */
export function spawnEdge(m: MapSize): number {
  return Math.min(LINE_SPACING, Math.min(m.width, m.height) >> 3);
}

/** The map area the generator's counts and try limits were tuned for. Not a map dimension. */
const REF_AREA = 16000 * 16000;

/** `base` scaled by map area, rounded down. Exact at the reference area. Integer maths only. */
export function scaledCount(base: number, m: MapSize): number {
  return Math.floor((base * m.width * m.height) / REF_AREA);
}

/** An edge margin `base` shrunk so it never exceeds an eighth of the short side. */
export function edgeMargin(base: number, m: MapSize): number {
  return Math.min(base, Math.min(m.width, m.height) >> 3);
}

/** Shortest side a map may have: room for fields, edge margins and a spawn on each side. */
export const MIN_MAP_SIDE = 2000;

/** Every reason these generator params cannot make a map. Empty = valid. Cheap: run before generating. */
export function validateMapParams(p: MapParams): string[] {
  const errors = dimensionErrors(p);
  if (errors.length === 0 && Math.min(p.width, p.height) < MIN_MAP_SIDE) errors.push(`a side is under ${MIN_MAP_SIDE}`);
  return errors;
}

/** Every reason the spec is not a playable map. Empty = valid. */
export function validateMapSpec(s: MapSpec): string[] {
  const errors = dimensionErrors(s);
  if (errors.length > 0) return errors;
  const m: MapSize = { width: s.width, height: s.height };
  const cols = s.width / s.cell + 1, rows = s.height / s.cell + 1;
  if (!isUint32(s.rng)) errors.push("rng is not a uint32");
  if (s.heights.length !== cols * rows) errors.push(`heights has ${s.heights.length} entries, need ${cols * rows}`);
  else if (s.heights.some((h) => !Number.isInteger(h) || h < 0 || h > TERRAIN_MAX_HEIGHT)) errors.push(`a height is not an integer in 0..${TERRAIN_MAX_HEIGHT}`);
  if (s.fields.length > MAX_FIELDS) errors.push(`${s.fields.length} fields, at most ${MAX_FIELDS}`);
  if (s.fields.some((f) => !fieldOk(m, f))) errors.push("a field is off the map, not integer, or not positive");
  if (s.features.some((f) => !featureOk(m, f))) errors.push("a feature is off the map or not integer");
  return errors;
}

/** A field lies wholly inside the map. */
function fieldOk(m: MapSize, f: MapSpec["fields"][number]): boolean {
  if (!Number.isInteger(f.radius) || f.radius <= 0 || !Number.isInteger(f.amount) || f.amount <= 0) return false;
  const inner = { width: m.width - 2 * f.radius, height: m.height - 2 * f.radius };
  return pointOk(inner, f.x - f.radius, f.y - f.radius);
}

/** A feature's centre is on the map. */
function featureOk(m: MapSize, f: MapSpec["features"][number]): boolean {
  return pointOk(m, f.x, f.y) && Number.isInteger(f.radius) && Number.isInteger(f.variant);
}

function dimensionErrors(s: MapParams): string[] {
  const errors: string[] = [];
  const { width, height, cell } = s;
  if (![width, height, cell].every((n) => Number.isInteger(n) && n > 0)) return ["width, height and cell must be positive integers"];
  if (LINE_SPACING % cell !== 0) errors.push(`cell ${cell} does not divide ${LINE_SPACING}`);
  if (width % cell !== 0 || height % cell !== 0) errors.push(`cell ${cell} does not divide ${width}x${height}`);
  if (errors.length > 0) return errors;
  const cols = width / cell + 1, rows = height / cell + 1;
  if (cols * rows > MAX_VERTICES) errors.push(`${cols * rows} vertices, at most ${MAX_VERTICES}`);
  if (Math.max(cols, rows) - 1 > MAX_SIDE_CELLS) errors.push(`a side has more than ${MAX_SIDE_CELLS} cells`);
  return errors;
}

function pointOk(m: MapSize, x: number, y: number): boolean {
  return Number.isInteger(x) && Number.isInteger(y) && x >= 0 && y >= 0 && x <= m.width && y <= m.height;
}

function isUint32(n: number): boolean {
  return Number.isInteger(n) && n >= 0 && n <= 0xffffffff;
}
