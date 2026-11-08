import { assignSpots, type Spot } from "./formation.ts";
import { dist2, isqrt } from "./math.ts";
import { clampX, clampY } from "./mapSize.ts";
import type { MapSize } from "./types.ts";

/** A point on a move path, in world units. */
export interface PathPoint {
  x: number;
  y: number;
}

/**
 * `n` points spread evenly by arc length along the polyline. Point i sits at the
 * centre of the i-th of n equal pieces, so one point is the arc-length midpoint.
 * Integer math only. Points are clamped to the map.
 */
export function spreadAlong(path: readonly PathPoint[], n: number, m: MapSize): PathPoint[] {
  if (n <= 0 || path.length === 0) return [];
  const cum = cumulativeLengths(path);
  const total = cum[cum.length - 1]!;
  const out: PathPoint[] = [];
  for (let i = 0; i < n; i++) out.push(pointAt(path, cum, Math.floor(((2 * i + 1) * total) / (2 * n)), m));
  return out;
}

/**
 * Spots spread along the path, one per unit. Units are ranked by how far along the
 * path's start-to-end direction they start (ties by id); rank i takes point i, so
 * paths do not cross. A path with no length falls back to a block at its point.
 */
export function assignAlongPath(from: readonly Spot[], path: readonly PathPoint[], m: MapSize): Spot[] {
  if (from.length === 0 || path.length === 0) return [];
  const p0 = path[0]!;
  if (pathLength(path) === 0) return assignSpots(from, p0.x, p0.y, m);
  const points = spreadAlong(path, from.length, m);
  const ranked = rankAlong(from, p0, path[path.length - 1]!);
  return ranked.map((s, i) => ({ unit: s.unit, x: points[i]!.x, y: points[i]!.y }));
}

/** Units in order of their integer dot product with the start-to-end direction. Ties by id. */
function rankAlong(from: readonly Spot[], a: PathPoint, b: PathPoint): Spot[] {
  const dx = b.x - a.x, dy = b.y - a.y;
  const along = (s: Spot) => (s.x - a.x) * dx + (s.y - a.y) * dy;
  return [...from].sort((p, q) => along(p) - along(q) || p.unit.id - q.unit.id);
}

/** cum[i] = integer arc length from path[0] to path[i]. */
function cumulativeLengths(path: readonly PathPoint[]): number[] {
  const cum = [0];
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1]!, b = path[i]!;
    cum.push(cum[i - 1]! + isqrt(dist2(a.x, a.y, b.x, b.y)));
  }
  return cum;
}

function pathLength(path: readonly PathPoint[]): number {
  const cum = cumulativeLengths(path);
  return cum[cum.length - 1]!;
}

/** The point at arc length `d`. Zero-length pieces are skipped. */
function pointAt(path: readonly PathPoint[], cum: readonly number[], d: number, m: MapSize): PathPoint {
  for (let i = 1; i < path.length; i++) {
    const len = cum[i]! - cum[i - 1]!;
    if (len === 0 || (d > cum[i]! && i < path.length - 1)) continue;
    const a = path[i - 1]!, b = path[i]!;
    const t = d - cum[i - 1]!;
    return {
      x: clampX(m, a.x + Math.floor(((b.x - a.x) * t) / len)),
      y: clampY(m, a.y + Math.floor(((b.y - a.y) * t) / len)),
    };
  }
  const p = path[path.length - 1]!;
  return { x: clampX(m, p.x), y: clampY(m, p.y) };
}
