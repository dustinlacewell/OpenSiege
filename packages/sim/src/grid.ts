import type { MapSize, Unit } from "./types.ts";

const CELL = 1000;

/**
 * Spatial hash over unit indices. Built by counting sort, so each cell keeps
 * index order. Queries walk cells row by row: the result order is fixed.
 */
export interface Grid {
  /** Indices into the units array the grid was built from, inside the square around (x, y) ± r. Caller checks exact distance. */
  query(x: number, y: number, r: number, out: number[]): number[];
}

function cellCoord(v: number, side: number): number {
  const c = Math.floor(v / CELL);
  return c < 0 ? 0 : c >= side ? side - 1 : c;
}

export function buildGrid(units: readonly Unit[], m: MapSize): Grid {
  const sideX = Math.ceil(m.width / CELL), sideY = Math.ceil(m.height / CELL);
  const cells = sideX * sideY;
  const n = units.length;
  const cellOf = new Int32Array(n);
  const start = new Int32Array(cells + 1);
  for (let i = 0; i < n; i++) {
    const u = units[i]!;
    const c = cellCoord(u.y, sideY) * sideX + cellCoord(u.x, sideX);
    cellOf[i] = c;
    start[c + 1]!++;
  }
  for (let c = 0; c < cells; c++) start[c + 1]! += start[c]!;
  const fill = start.slice(0, cells);
  const items = new Int32Array(n);
  for (let i = 0; i < n; i++) items[fill[cellOf[i]!]!++] = i;

  return {
    query(x, y, r, out) {
      out.length = 0;
      const x0 = cellCoord(x - r, sideX), x1 = cellCoord(x + r, sideX);
      const y0 = cellCoord(y - r, sideY), y1 = cellCoord(y + r, sideY);
      for (let cy = y0; cy <= y1; cy++) {
        for (let cx = x0; cx <= x1; cx++) {
          const c = cy * sideX + cx;
          for (let k = start[c]!; k < start[c + 1]!; k++) out.push(items[k]!);
        }
      }
      return out;
    },
  };
}
