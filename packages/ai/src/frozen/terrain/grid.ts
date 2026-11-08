import type { Point } from "../geometry.ts";

/** A coarse grid over the map, row-major (j · cols + i). Every layer of a `MapStudy` has `cols * rows` cells. */
export interface StudyGrid {
  cols: number;
  rows: number;
  /** World units per cell side. */
  cell: number;
}

/** Step cost of an orthogonal move. A diagonal costs `DIAG`. Integers, so equal path lengths tie exactly. */
export const ORTHO = 10;
export const DIAG = 14;

/** The eight neighbour offsets: four orthogonal, then four diagonal. */
const STEPS: readonly (readonly [number, number])[] = [
  [1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1],
];

/** The cell holding world point p, clamped to the grid. */
export function cellAt(g: StudyGrid, p: Point): number {
  const i = Math.min(g.cols - 1, Math.max(0, Math.floor(p.x / g.cell)));
  const j = Math.min(g.rows - 1, Math.max(0, Math.floor(p.y / g.cell)));
  return j * g.cols + i;
}

/** World centre of a cell. */
export function centreOf(g: StudyGrid, c: number): Point {
  return { x: ((c % g.cols) + 0.5) * g.cell, y: (Math.floor(c / g.cols) + 0.5) * g.cell };
}

/**
 * Calls `visit(n, cost)` for each passable 8-neighbour of passable cell c. A diagonal needs both orthogonal
 * cells open, so no path cuts a blocked corner.
 */
export function eachNeighbour(g: StudyGrid, passable: Uint8Array, c: number, visit: (n: number, cost: number) => void): void {
  const i = c % g.cols, j = Math.floor(c / g.cols);
  for (const [di, dj] of STEPS) {
    const ni = i + di, nj = j + dj;
    if (ni < 0 || nj < 0 || ni >= g.cols || nj >= g.rows) continue;
    const n = nj * g.cols + ni;
    if (!passable[n]) continue;
    if (di !== 0 && dj !== 0 && (!passable[j * g.cols + ni] || !passable[nj * g.cols + i])) continue;
    visit(n, di !== 0 && dj !== 0 ? DIAG : ORTHO);
  }
}

/** The passable cell nearest p, searched ring by ring out from p's cell. undefined when no cell is passable. */
export function nearestPassable(g: StudyGrid, passable: Uint8Array, p: Point): number | undefined {
  const c = cellAt(g, p);
  if (passable[c]) return c;
  const ci = c % g.cols, cj = Math.floor(c / g.cols);
  const most = Math.max(g.cols, g.rows);
  for (let r = 1; r < most; r++) {
    let best: number | undefined, bestD = Infinity;
    for (let j = cj - r; j <= cj + r; j++) {
      for (let i = ci - r; i <= ci + r; i++) {
        if (Math.max(Math.abs(i - ci), Math.abs(j - cj)) !== r) continue;
        if (i < 0 || j < 0 || i >= g.cols || j >= g.rows || !passable[j * g.cols + i]) continue;
        const d = (i - ci) ** 2 + (j - cj) ** 2;
        if (d < bestD) { bestD = d; best = j * g.cols + i; }
      }
    }
    if (best !== undefined) return best;
  }
  return undefined;
}
