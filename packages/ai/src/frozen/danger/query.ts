import type { MapSize } from "@mf/sim";
import { dist, type Point } from "../geometry.ts";
import { cellCentre, cellIndex, DANGER_CELL, type DangerGrid } from "./grid.ts";
import type { Scar } from "./scar.ts";

/** The danger map: live danger from known enemies plus the remembered scar. All four grids share cells. */
export interface Danger {
  live: DangerGrid;
  scar: Scar;
}

/** Enemy power that can hit the cell holding (x, y). */
export function dangerAt(d: Danger, x: number, y: number): number {
  const n = cellIndex(d.live, x, y);
  return d.live.values[n]! + d.scar.sight.values[n]! + d.scar.damage.values[n]! + d.scar.loss.values[n]!;
}

/** The most danger on the straight line from `a` to `b`, sampled once per cell length. */
export function dangerAlong(d: Danger, a: Point, b: Point): number {
  const steps = Math.max(1, Math.ceil(dist(a, b) / DANGER_CELL));
  let worst = 0;
  for (let s = 0; s <= steps; s++) {
    const t = s / steps;
    worst = Math.max(worst, dangerAt(d, a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t));
  }
  return worst;
}

/** The cell centre within `r` of `p`, on the map, with the best `score(cell) - dangerAt(cell)`. null if no cell fits. */
export function safestNear(d: Danger, m: MapSize, p: Point, r: number, score: (cell: Point) => number): Point | null {
  const lo = (v: number): number => Math.max(0, Math.floor((v - r) / DANGER_CELL));
  const hiX = Math.min(d.live.cols - 1, Math.floor((p.x + r) / DANGER_CELL));
  const hiY = Math.min(d.live.rows - 1, Math.floor((p.y + r) / DANGER_CELL));
  let best: Point | null = null;
  let bestValue = -Infinity;
  for (let j = lo(p.y); j <= hiY; j++) {
    for (let i = lo(p.x); i <= hiX; i++) {
      const c = cellCentre(i, j);
      if (c.x >= m.width || c.y >= m.height || dist(c, p) > r) continue;
      const value = score(c) - dangerAt(d, c.x, c.y);
      if (value > bestValue) {
        best = c;
        bestValue = value;
      }
    }
  }
  return best;
}
