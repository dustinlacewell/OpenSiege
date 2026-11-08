import { ANGLE_STEPS } from "../stats.ts";
import { isqrt } from "../math.ts";
import type { Point } from "./navGrid.ts";

/** A look-ahead point. `end`: it is the last point of the path, so reaching it finishes the order. */
export interface Aim extends Point { end: boolean }

/**
 * How far ahead along the path a unit aims: twice its radius, or its turn radius if that is more.
 * The turn radius is speed · ANGLE_STEPS / (2π · turnRate), with 2π as 44 / 7.
 */
export function lookDistance(radius: number, speed: number, turnRate: number): number {
  return Math.max(2 * radius, Math.floor((speed * ANGLE_STEPS * 7) / (44 * turnRate)));
}

/**
 * Pure pursuit. The point `look` units ahead along the polyline from `from` through `path`.
 * When the whole polyline is shorter than `look`, the last point, with `end` set.
 */
export function aimAlong(from: Point, path: readonly Point[], look: number): Aim {
  let at = from;
  let left = look;
  for (let i = 0; i < path.length; i++) {
    const p = path[i]!;
    const len = distance(at, p);
    if (len > left) {
      return { x: at.x + Math.trunc(((p.x - at.x) * left) / len), y: at.y + Math.trunc(((p.y - at.y) * left) / len), end: false };
    }
    left -= len;
    at = p;
  }
  return { x: at.x, y: at.y, end: true };
}

/** Length of the polyline from `from` through `path`. */
export function pathLength(from: Point, path: readonly Point[]): number {
  let at = from;
  let total = 0;
  for (const p of path) {
    total += distance(at, p);
    at = p;
  }
  return total;
}

function distance(a: Point, b: Point): number {
  const dx = b.x - a.x, dy = b.y - a.y;
  return isqrt(dx * dx + dy * dy);
}
