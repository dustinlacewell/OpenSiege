import { ANGLE_STEPS } from "./stats.ts";

/** Exact floor(sqrt(n)) for integer n >= 0 (n < 2^52). Float sqrt is only a first guess. */
export function isqrt(n: number): number {
  if (n <= 0) return 0;
  let r = Math.floor(Math.sqrt(n));
  while (r * r > n) r--;
  while ((r + 1) * (r + 1) <= n) r++;
  return r;
}

export function dist2(ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  return dx * dx + dy * dy;
}

const QUARTER = ANGLE_STEPS / 4;
const EIGHTH = ANGLE_STEPS / 8;

/**
 * Integer angle of (dx, dy) in 0..ANGLE_STEPS-1. 0 = +x, a quarter turn = +y.
 * Linear within each octant. Returns `fallback` for a zero vector.
 */
export function angleOf(dx: number, dy: number, fallback: number): number {
  if (dx === 0 && dy === 0) return fallback;
  const ax = Math.abs(dx);
  const ay = Math.abs(dy);
  const a = ax >= ay ? Math.trunc((EIGHTH * ay) / ax) : QUARTER - Math.trunc((EIGHTH * ax) / ay);
  if (dx >= 0 && dy >= 0) return a % ANGLE_STEPS;
  if (dx < 0 && dy >= 0) return ANGLE_STEPS / 2 - a;
  if (dx < 0) return ANGLE_STEPS / 2 + a;
  return (ANGLE_STEPS - a) % ANGLE_STEPS;
}

/** Signed shortest turn from `from` to `to`, in -ANGLE_STEPS/2..ANGLE_STEPS/2-1. */
export function angleDelta(from: number, to: number): number {
  const half = ANGLE_STEPS / 2;
  return ((((to - from) % ANGLE_STEPS) + ANGLE_STEPS + half) % ANGLE_STEPS) - half;
}

/** Turn `from` toward `to` the short way, by at most `max` steps. */
export function turnToward(from: number, to: number, max: number): number {
  const d = angleDelta(from, to);
  const turn = d > max ? max : d < -max ? -max : d;
  return (from + turn + ANGLE_STEPS) % ANGLE_STEPS;
}

/** Integer coercion for values from outside the sim. NaN or non-number gives null. */
export function toInt(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? Math.trunc(v) : null;
}
