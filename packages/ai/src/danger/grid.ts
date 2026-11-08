import type { MapSize } from "@mf/sim";
import type { Point } from "../geometry.ts";

/** Danger cells are this many world units on a side. */
export const DANGER_CELL = 400;

/** Enemy power per cell. Row-major `values[j * cols + i]`. */
export interface DangerGrid {
  cell: typeof DANGER_CELL;
  cols: number;
  rows: number;
  values: Float64Array;
}

/** All zero, sized to the map. */
export function emptyGrid(m: MapSize): DangerGrid {
  const cols = Math.ceil(m.width / DANGER_CELL);
  const rows = Math.ceil(m.height / DANGER_CELL);
  return { cell: DANGER_CELL, cols, rows, values: new Float64Array(cols * rows) };
}

export function fitsMap(g: DangerGrid, m: MapSize): boolean {
  return g.cols === Math.ceil(m.width / DANGER_CELL) && g.rows === Math.ceil(m.height / DANGER_CELL);
}

/** Adds `power` x falloff to each cell whose centre lies within `reach`. Writes `grid` in place; callers stamp only grids they made. */
export function stamp(grid: DangerGrid, x: number, y: number, power: number, reach: number): void {
  if (power <= 0 || reach <= 0) return;
  const lo = (v: number): number => Math.max(0, Math.floor((v - reach) / DANGER_CELL));
  const hiX = Math.min(grid.cols - 1, Math.floor((x + reach) / DANGER_CELL));
  const hiY = Math.min(grid.rows - 1, Math.floor((y + reach) / DANGER_CELL));
  for (let j = lo(y); j <= hiY; j++) {
    for (let i = lo(x); i <= hiX; i++) {
      const c = cellCentre(i, j);
      const f = falloff(Math.hypot(c.x - x, c.y - y), reach);
      if (f > 0) grid.values[j * grid.cols + i]! += power * f;
    }
  }
}

/** 1 out to half the reach, then linear to 0 at the reach. */
export function falloff(d: number, reach: number): number {
  if (d > reach) return 0;
  const half = reach / 2;
  return d <= half ? 1 : (reach - d) / half;
}

/** A copy with every cell times `factor`. The input is not changed. */
export function fade(grid: DangerGrid, factor: number): DangerGrid {
  const values = new Float64Array(grid.values.length);
  for (let n = 0; n < values.length; n++) values[n] = grid.values[n]! * factor;
  return { ...grid, values };
}

/** The cell index holding `p`, clamped onto the grid. */
export function cellIndex(grid: DangerGrid, x: number, y: number): number {
  const i = Math.min(grid.cols - 1, Math.max(0, Math.floor(x / DANGER_CELL)));
  const j = Math.min(grid.rows - 1, Math.max(0, Math.floor(y / DANGER_CELL)));
  return j * grid.cols + i;
}

export function cellCentre(i: number, j: number): Point {
  return { x: i * DANGER_CELL + DANGER_CELL / 2, y: j * DANGER_CELL + DANGER_CELL / 2 };
}
