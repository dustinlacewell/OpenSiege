import type { MoveClass } from "../stats.ts";
import type { Terrain } from "../types.ts";
import { cellGrade } from "./cellGrade.ts";
import { CLASS_PARAMS } from "./moveClass.ts";

/** The nav grid's size: one nav cell per terrain cell, so one fewer than the vertices on each axis. */
export interface NavShape { cols: number; rows: number; cell: number }

export const navShape = (t: Terrain): NavShape => ({ cols: t.cols - 1, rows: t.rows - 1, cell: t.cell });

/** Value of a cell no unit of the class may enter. An open cell is 0. */
export const BLOCKED = 1;
const OPEN = 0;

/** One value per cell, row-major (j · shape.cols + i): OPEN or BLOCKED. */
export type NavGrid = Uint8Array;

/** Cell column of a world x. The far map edge counts in the last cell; points off the map clamp to the grid. */
export function colOf(s: NavShape, x: number): number {
  const c = Math.floor(x / s.cell);
  return c < 0 ? 0 : c >= s.cols ? s.cols - 1 : c;
}

/** Cell row of a world y. The far map edge counts in the last cell; points off the map clamp to the grid. */
export function rowOf(s: NavShape, y: number): number {
  const r = Math.floor(y / s.cell);
  return r < 0 ? 0 : r >= s.rows ? s.rows - 1 : r;
}

/** Index of the cell holding world point (x, y). */
export function cellIndexAt(s: NavShape, x: number, y: number): number {
  return rowOf(s, y) * s.cols + colOf(s, x);
}

/** World coordinate of a cell column or row's centre. */
export function cellCentre(s: NavShape, c: number): number {
  return c * s.cell + (s.cell >> 1);
}

export interface Point { x: number; y: number }

/** Centre of the cell with this index. */
export function centreOfCell(s: NavShape, cell: number): Point {
  return { x: cellCentre(s, cell % s.cols), y: cellCentre(s, Math.floor(cell / s.cols)) };
}

/** An inclusive rectangle of cells. */
export interface CellBox { i0: number; j0: number; i1: number; j1: number }

export function wholeMap(s: NavShape): CellBox {
  return { i0: 0, j0: 0, i1: s.cols - 1, j1: s.rows - 1 };
}

/** The box grown by `n` cells on every side, kept on the map. */
export function growBox(s: NavShape, b: CellBox, n: number): CellBox {
  return { i0: Math.max(0, b.i0 - n), j0: Math.max(0, b.j0 - n), i1: Math.min(s.cols - 1, b.i1 + n), j1: Math.min(s.rows - 1, b.j1 + n) };
}

/**
 * The grid of one move class, from the terrain heights.
 * `featureBlock` is this class's count of blocking features over each cell (`featureCells.ts`); a cell with a count is blocked.
 */
export function buildNavGrid(terrain: Terrain, cls: MoveClass, featureBlock: Uint8Array): NavGrid {
  const shape = navShape(terrain);
  const grid = new Uint8Array(shape.cols * shape.rows);
  refreshCells(shape, grid, terrain, cls, featureBlock, wholeMap(shape));
  return grid;
}

/**
 * Recompute the cells of `box` in place. A cell is blocked when a feature count covers it, or when its grade
 * is above the class's `maxGrade`. It reads nothing outside itself, so a box is exact on its own.
 */
export function refreshCells(s: NavShape, grid: NavGrid, terrain: Terrain, cls: MoveClass, featureBlock: Uint8Array, box: CellBox): void {
  const maxGrade = CLASS_PARAMS[cls].maxGrade;
  for (let j = box.j0; j <= box.j1; j++) {
    for (let i = box.i0; i <= box.i1; i++) {
      const blocked = featureBlock[j * s.cols + i]! > 0 || cellGrade(terrain, i, j) > maxGrade;
      grid[j * s.cols + i] = blocked ? BLOCKED : OPEN;
    }
  }
}
