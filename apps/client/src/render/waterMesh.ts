// The water surface grid: dense round the camera, coarser outward. Pure.
import { ringsFor } from "./surround.ts";

/** Spacing of the fine core, in world units. The waves need about 8 vertices per shortest wavelength. */
export const WATER_FINE_SPACING = 32;
/** Fine steps from the centre to each side. */
export const WATER_FINE_STEPS = 96;
/** Steps past the fine core to the reach, each a fixed ratio longer than the last. */
export const WATER_COARSE_STEPS = 64;

/** Offsets from the grid centre: `xy` per vertex, `side` by `side`, row-major. Two triangles per cell. */
export interface WaterGrid {
  positions: Float32Array;
  indices: Uint32Array;
  side: number;
}

/** How far the grid reaches from its centre: a camera anywhere on the map still covers the whole mirrored surround. */
export function waterReach(width: number, height: number): number {
  return (ringsFor(width, height) + 1) * Math.max(width, height);
}

/**
 * Sorted coordinates on one axis, -reach..reach, symmetric about 0: `fineSteps` of `fine` each side, then
 * `coarseSteps` that grow by one ratio and end exactly at `reach`. A reach inside the core ends at the core.
 */
export function waterAxis(reach: number, fine: number, fineSteps: number, coarseSteps: number): number[] {
  const half = [0];
  for (let k = 1; k <= fineSteps; k++) half.push(k * fine);
  const core = fineSteps * fine;
  const span = reach - core;
  if (span > 0 && coarseSteps > 0) {
    appendCoarse(half, core, span, fine, coarseSteps);
    half[half.length - 1] = reach;
  }
  const neg = half.slice(1).reverse().map((x) => -x);
  return [...neg, ...half];
}

/** The growth ratio g with first·g + first·g² + … + first·gⁿ = span. 1 when n uniform steps of `first` already cover it. */
export function growthFor(span: number, first: number, steps: number): number {
  const sum = (g: number): number => (g === 1 ? first * steps : (first * g * (g ** steps - 1)) / (g - 1));
  if (sum(1) >= span) return 1;
  let lo = 1, hi = 2;
  while (sum(hi) < span) hi *= 2;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (sum(mid) < span) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/** The full tensor grid over `axis` on both x and y. It has no T-junctions, so it never cracks. */
export function buildWaterGrid(axis: readonly number[]): WaterGrid {
  const side = axis.length;
  const positions = new Float32Array(side * side * 2);
  for (let j = 0; j < side; j++) {
    for (let i = 0; i < side; i++) {
      positions[(j * side + i) * 2] = axis[i]!;
      positions[(j * side + i) * 2 + 1] = axis[j]!;
    }
  }
  return { positions, indices: gridIndices(side), side };
}

function appendCoarse(half: number[], core: number, span: number, fine: number, steps: number): void {
  const g = growthFor(span, fine, steps);
  const uniform = g === 1 ? span / steps : 0;
  let x = core, step = fine;
  for (let k = 1; k <= steps; k++) {
    step = uniform || step * g;
    x += step;
    half.push(x);
  }
}

function gridIndices(side: number): Uint32Array {
  const cells = side - 1;
  const out = new Uint32Array(cells * cells * 6);
  let o = 0;
  for (let j = 0; j < cells; j++) {
    for (let i = 0; i < cells; i++) {
      const a = j * side + i, b = a + 1, c = a + side, d = c + 1;
      out[o++] = a; out[o++] = b; out[o++] = d;
      out[o++] = a; out[o++] = d; out[o++] = c;
    }
  }
  return out;
}
