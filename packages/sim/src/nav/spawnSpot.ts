import { BLOCKED, cellIndexAt, type NavGrid, type NavShape, type Point } from "./navGrid.ts";
import { openPoint } from "./openPoint.ts";

/** Eight directions, scaled by 1000. */
const DIRECTIONS: readonly (readonly [number, number])[] = [
  [1000, 0], [707, 707], [0, 1000], [-707, 707], [-1000, 0], [-707, -707], [0, -1000], [707, -707],
];
const RINGS = 6;
const RING_STEP = 24;

export interface Body { readonly x: number; readonly y: number; readonly radius: number }

/**
 * A spot for a new body of `radius` beside `from`, starting at `reach` and moving out ring by ring.
 * Within a ring it tries the eight directions from `first` on. A spot needs an open cell and no overlap with `bodies`.
 * When no spot is free it falls back to the first direction's point, moved to the nearest open cell.
 */
export function spawnSpot(s: NavShape, grid: NavGrid, from: Point, reach: number, radius: number, first: number, bodies: readonly Body[]): Point {
  for (let ring = 0; ring < RINGS; ring++) {
    const r = reach + ring * RING_STEP;
    for (let i = 0; i < DIRECTIONS.length; i++) {
      const p = pointAt(from, r, first + i);
      if (grid[cellIndexAt(s, p.x, p.y)] === BLOCKED) continue;
      if (!overlaps(p, radius, bodies)) return p;
    }
  }
  const p = pointAt(from, reach, first);
  return openPoint(s, grid, p.x, p.y);
}

function pointAt(from: Point, reach: number, direction: number): Point {
  const [dx, dy] = DIRECTIONS[direction % DIRECTIONS.length]!;
  return { x: from.x + Math.trunc((dx * reach) / 1000), y: from.y + Math.trunc((dy * reach) / 1000) };
}

function overlaps(p: Point, radius: number, bodies: readonly Body[]): boolean {
  for (const b of bodies) {
    const dx = b.x - p.x, dy = b.y - p.y, min = b.radius + radius;
    if (dx * dx + dy * dy < min * min) return true;
  }
  return false;
}
