import { isqrt } from "./math.ts";
import { heightAt } from "./terrain.ts";
import type { Terrain } from "./types.ts";

/**
 * True when no terrain rises above the straight line from (x0, y0, z0) to (x1, y1, z1).
 * The two ends are not sampled: they stand on the ground they start from.
 * Samples are at most half a terrain cell apart, so no ridge of the height map slips between them.
 * Integer only: sample k of n sits at x0 + floor(dx * k / n), and heights compare cross-multiplied by n.
 */
export function clearLine(terrain: Terrain, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number): boolean {
  const dx = x1 - x0, dy = y1 - y0, dz = z1 - z0;
  const n = sampleCount(terrain, isqrt(dx * dx + dy * dy));
  for (let k = 1; k < n; k++) {
    const h = heightAt(terrain, x0 + Math.floor((dx * k) / n), y0 + Math.floor((dy * k) / n));
    if (h * n > z0 * n + dz * k) return false;
  }
  return true;
}

/** Segments of at most half a cell along a line `length` long. */
function sampleCount(terrain: Terrain, length: number): number {
  const half = Math.max(1, Math.floor(terrain.cell / 2));
  return Math.floor((length + half - 1) / half);
}
