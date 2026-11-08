import type { MapSize } from "@mf/sim";
import type { Point } from "../geometry.ts";
import type { Eye } from "../perception/picture.ts";

/** Scout cells are this many world units on a side. */
export const SCOUT_CELL = 1000;
/** An eye marks a cell when the cell centre is this close, at least. Short-sighted units still mark their own cell. */
const MIN_REACH = 600;

/** Last tick each scout cell was in sight, -1 never. Row-major `seen[j * cols + i]`. */
export interface Explored {
  cols: number;
  rows: number;
  seen: readonly number[];
}

/** No cells yet. `markExplored` sizes it to the map on first use. */
export function emptyExplored(): Explored {
  return { cols: 0, rows: 0, seen: [] };
}

const colsOf = (m: MapSize): number => Math.ceil(m.width / SCOUT_CELL);
const rowsOf = (m: MapSize): number => Math.ceil(m.height / SCOUT_CELL);

/** Stamps `tick` on every cell whose centre some eye can see. Resizes (all unseen) when the map differs. */
export function markExplored(explored: Explored, eyes: readonly Eye[], tick: number, m: MapSize): Explored {
  const cols = colsOf(m);
  const rows = rowsOf(m);
  const fits = explored.cols === cols && explored.rows === rows;
  const out = fits ? explored.seen.slice() : new Array<number>(cols * rows).fill(-1);
  for (const e of eyes) {
    const reach = Math.max(e.sight, MIN_REACH);
    const lo = (v: number): number => Math.max(0, Math.floor((v - reach) / SCOUT_CELL));
    const hiX = Math.min(cols - 1, Math.floor((e.x + reach) / SCOUT_CELL));
    const hiY = Math.min(rows - 1, Math.floor((e.y + reach) / SCOUT_CELL));
    for (let j = lo(e.y); j <= hiY; j++) {
      for (let i = lo(e.x); i <= hiX; i++) {
        const c = cellCentre(i, j);
        if ((c.x - e.x) ** 2 + (c.y - e.y) ** 2 <= reach * reach) out[j * cols + i] = tick;
      }
    }
  }
  return { cols, rows, seen: out };
}

export function cellCentre(i: number, j: number): Point {
  return { x: i * SCOUT_CELL + SCOUT_CELL / 2, y: j * SCOUT_CELL + SCOUT_CELL / 2 };
}

/** Cell centres with the tick each was last seen. */
export function scoutCells(explored: Explored): { at: Point; seen: number }[] {
  return explored.seen.map((seen, n) => ({ at: cellCentre(n % explored.cols, Math.floor(n / explored.cols)), seen }));
}
