import { TERRAIN_MAX_HEIGHT } from "@mf/sim";
import { brushWeight } from "./brushWeight.ts";
import type { HeightChange } from "./changes.ts";

export type HeightOp = "raise" | "lower" | "smooth" | "flatten" | "noise";

/** The heights a brush reads: the grid shape and the values. */
export interface HeightGrid {
  cols: number;
  rows: number;
  cell: number;
  heights: readonly number[];
}

export interface Brush {
  /** World position of the centre. */
  x: number;
  y: number;
  /** World units. */
  radius: number;
  /** Height units per application at full weight. */
  strength: number;
  /** 0 hard edge .. 1 soft dome. */
  falloff: number;
  /** Flatten target. Other ops ignore it. */
  target?: number;
  /** Noise seed. Only `noise` reads it. */
  seed?: number;
}

/** Heights `op` would write for one stroke dab. Pure: `grid` is not changed. */
export function heightBrush(grid: HeightGrid, op: HeightOp, brush: Brush): HeightChange[] {
  const { cols, rows, cell, heights } = grid;
  const i0 = Math.max(0, Math.ceil((brush.x - brush.radius) / cell));
  const i1 = Math.min(cols - 1, Math.floor((brush.x + brush.radius) / cell));
  const j0 = Math.max(0, Math.ceil((brush.y - brush.radius) / cell));
  const j1 = Math.min(rows - 1, Math.floor((brush.y + brush.radius) / cell));
  const out: HeightChange[] = [];
  for (let j = j0; j <= j1; j++) {
    for (let i = i0; i <= i1; i++) {
      const w = brushWeight(Math.hypot(i * cell - brush.x, j * cell - brush.y), brush.radius, brush.falloff);
      if (w === 0) continue;
      const index = j * cols + i;
      const before = heights[index]!;
      const after = clampHeight(target(grid, op, brush, i, j, before, w));
      if (after !== before) out.push({ index, before, after });
    }
  }
  return out;
}

function target(g: HeightGrid, op: HeightOp, b: Brush, i: number, j: number, h: number, w: number): number {
  switch (op) {
    case "raise": return h + b.strength * w;
    case "lower": return h - b.strength * w;
    case "flatten": return h + ((b.target ?? h) - h) * Math.min(1, (b.strength / TERRAIN_MAX_HEIGHT) * w * 8);
    case "smooth": return h + (neighbourMean(g, i, j) - h) * Math.min(1, w * (b.strength / 10));
    case "noise": return h + (hash01(i, j, b.seed ?? 0) * 2 - 1) * b.strength * w;
  }
}

function neighbourMean(g: HeightGrid, i: number, j: number): number {
  let sum = 0;
  let n = 0;
  for (let dj = -1; dj <= 1; dj++) {
    for (let di = -1; di <= 1; di++) {
      const ii = i + di;
      const jj = j + dj;
      if (ii < 0 || jj < 0 || ii >= g.cols || jj >= g.rows) continue;
      sum += g.heights[jj * g.cols + ii]!;
      n++;
    }
  }
  return sum / n;
}

const clampHeight = (h: number): number => Math.max(0, Math.min(TERRAIN_MAX_HEIGHT, Math.round(h)));

/** Stable 0..1 value for a cell and seed. */
function hash01(i: number, j: number, seed: number): number {
  let h = Math.imul(i, 0x27d4eb2d) ^ Math.imul(j, 0x165667b1) ^ Math.imul(seed, 0x9e3779b1);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
