import { brushWeight } from "./brushWeight.ts";
import type { MaterialLayer } from "./types.ts";

export type Weights4 = [number, number, number, number];

/** One vertex's material weights before and after a dab. */
export interface MaterialChange {
  /** Vertex index `j * cols + i`. */
  index: number;
  before: Weights4;
  after: Weights4;
}

export interface MaterialGrid {
  cols: number;
  rows: number;
  cell: number;
}

export interface MaterialBrush {
  /** World position of the centre. */
  x: number;
  y: number;
  /** World units. */
  radius: number;
  /** 0..1 share of the remaining gap to 255 closed per dab at full weight. */
  strength: number;
  /** 0 hard edge .. 1 soft dome. */
  falloff: number;
}

/** Write one side of each change into the layer. */
export function applyMaterialChanges(layer: MaterialLayer, changes: readonly MaterialChange[], side: "before" | "after"): void {
  for (const c of changes) layer.weights.set(c[side], c.index * 4);
}

/** Weights one dab would write. Pure: `layer` is not changed. */
export function paintMaterial(grid: MaterialGrid, layer: MaterialLayer, channel: 0 | 1 | 2 | 3, brush: MaterialBrush): MaterialChange[] {
  const { cols, rows, cell } = grid;
  const i0 = Math.max(0, Math.ceil((brush.x - brush.radius) / cell));
  const i1 = Math.min(cols - 1, Math.floor((brush.x + brush.radius) / cell));
  const j0 = Math.max(0, Math.ceil((brush.y - brush.radius) / cell));
  const j1 = Math.min(rows - 1, Math.floor((brush.y + brush.radius) / cell));
  const out: MaterialChange[] = [];
  for (let j = j0; j <= j1; j++) {
    for (let i = i0; i <= i1; i++) {
      const w = brushWeight(Math.hypot(i * cell - brush.x, j * cell - brush.y), brush.radius, brush.falloff);
      if (w <= 0) continue;
      const index = j * cols + i;
      const before = read(layer, index);
      const after = shift(before, channel, Math.min(1, brush.strength * w));
      if (after.some((v, k) => v !== before[k])) out.push({ index, before, after });
    }
  }
  return out;
}

/** Vertex-index bounding box of the changes, or null when there are none. */
export function dirtyBounds(changes: readonly MaterialChange[], cols: number): { i0: number; j0: number; i1: number; j1: number } | null {
  if (changes.length === 0) return null;
  let i0 = Infinity;
  let j0 = Infinity;
  let i1 = -Infinity;
  let j1 = -Infinity;
  for (const { index } of changes) {
    const i = index % cols;
    const j = (index - i) / cols;
    if (i < i0) i0 = i;
    if (i > i1) i1 = i;
    if (j < j0) j0 = j;
    if (j > j1) j1 = j;
  }
  return { i0, j0, i1, j1 };
}

function read(layer: MaterialLayer, index: number): Weights4 {
  const o = index * 4;
  const w = layer.weights;
  return [w[o]!, w[o + 1]!, w[o + 2]!, w[o + 3]!];
}

/** Move `channel` toward 255 by `k` of the gap. Others shrink in proportion. The sum is 255. */
function shift(before: Weights4, channel: number, k: number): Weights4 {
  const t = before[channel]!;
  const gap = 255 - t;
  if (gap <= 0 || k <= 0) return [...before];
  const newT = Math.min(255, t + Math.ceil(gap * k));
  const othersSum = before[0] + before[1] + before[2] + before[3] - t;
  const scale = othersSum > 0 ? (255 - newT) / othersSum : 0;
  const after: Weights4 = [0, 0, 0, 0];
  let sum = 0;
  for (let c = 0; c < 4; c++) {
    if (c === channel) continue;
    after[c] = Math.floor(before[c]! * scale);
    sum += after[c]!;
  }
  after[channel] = 255 - sum;
  return after;
}
