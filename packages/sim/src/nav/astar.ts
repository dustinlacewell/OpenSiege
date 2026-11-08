import { BLOCKED, type NavGrid, type NavShape } from "./navGrid.ts";

const STRAIGHT = 10;
const DIAGONAL = 14;

/** The 8 neighbours in one fixed order, clockwise from north. Odd slots are diagonals. */
const DX: readonly number[] = [0, 1, 1, 1, 0, -1, -1, -1];
const DY: readonly number[] = [-1, -1, 0, 1, 1, 1, 0, -1];

// Scratch, reused by every search and grown (never shrunk) to the largest map seen. `stamp` marks which entries belong to the current search, so nothing is cleared.
let cost = new Int32Array(0);
let parent = new Int32Array(0);
let seen = new Uint32Array(0);
let done = new Uint32Array(0);
let stamp = 0;

function ensureScratch(cells: number): void {
  if (cost.length >= cells) return;
  cost = new Int32Array(cells);
  parent = new Int32Array(cells);
  seen = new Uint32Array(cells);
  done = new Uint32Array(cells);
  stamp = 0;
}

/**
 * Binary heap of two parallel arrays: `heapK` holds the sort key (f, then h), `heapC` the cell, the last tie-break.
 * The key is f · H_RANGE + h. A map has under 2^18 cells and at most 2048 per side, so g < 14 · 2^18 < 2^22,
 * h = 10 · (dx + dy) < 2^16 = H_RANGE, f < 2^22 + 2^16, and the key stays under 2^39, well inside 2^53.
 * (One number holding the cell too would reach 2^57.)
 */
const H_RANGE = 65536;
const heapK: number[] = [];
const heapC: number[] = [];

/**
 * The cheapest 8-neighbour path of open cells from `start` to `goal`, both cell indexes, as the cells in order.
 * Costs are 10 straight and 14 diagonal; the heuristic is the octile distance. A diagonal step needs both
 * cells beside it open: no cutting a blocked corner. Neighbours scan in one fixed order and the heap pops
 * the lower f, then the lower h, then the lower cell index, so every machine finds the same path.
 * Null when the goal cannot be reached.
 */
export function findCells(s: NavShape, grid: NavGrid, start: number, goal: number): number[] | null {
  ensureScratch(s.cols * s.rows);
  const id = ++stamp;
  const gx = goal % s.cols, gy = Math.floor(goal / s.cols);
  heapK.length = 0;
  heapC.length = 0;
  cost[start] = 0;
  parent[start] = -1;
  seen[start] = id;
  push(sortKey(0, octile(s, start, gx, gy)), start);
  while (heapK.length > 0) {
    const c = pop();
    if (done[c] === id) continue;
    done[c] = id;
    if (c === goal) return trace(goal);
    expand(s, grid, c, gx, gy, id);
  }
  return null;
}

function expand(s: NavShape, grid: NavGrid, c: number, gx: number, gy: number, id: number): void {
  const cols = s.cols;
  const cx = c % cols, cy = Math.floor(c / cols);
  for (let i = 0; i < 8; i++) {
    const x = cx + DX[i]!, y = cy + DY[i]!;
    if (x < 0 || y < 0 || x >= cols || y >= s.rows) continue;
    const n = y * cols + x;
    if (grid[n] === BLOCKED || done[n] === id) continue;
    const diagonal = (i & 1) === 1;
    if (diagonal && (grid[cy * cols + x] === BLOCKED || grid[y * cols + cx] === BLOCKED)) continue;
    const g = cost[c]! + (diagonal ? DIAGONAL : STRAIGHT);
    if (seen[n] === id && g >= cost[n]!) continue;
    seen[n] = id;
    cost[n] = g;
    parent[n] = c;
    push(sortKey(g, octile(s, n, gx, gy)), n);
  }
}

/** Octile distance from a cell to the goal, in the same 10 : 14 units. */
function octile(s: NavShape, cell: number, gx: number, gy: number): number {
  const dx = Math.abs((cell % s.cols) - gx), dy = Math.abs(Math.floor(cell / s.cols) - gy);
  return STRAIGHT * (dx + dy) - (2 * STRAIGHT - DIAGONAL) * Math.min(dx, dy);
}

function sortKey(g: number, h: number): number {
  return (g + h) * H_RANGE + h;
}

/** The cells from the start to `goal`, following the parents back. */
function trace(goal: number): number[] {
  const out: number[] = [];
  for (let c = goal; c >= 0; c = parent[c]!) out.push(c);
  return out.reverse();
}

/** True when entry (k, c) pops before entry (k2, c2). */
function before(k: number, c: number, k2: number, c2: number): boolean {
  return k < k2 || (k === k2 && c < c2);
}

function push(k: number, c: number): void {
  let i = heapK.length;
  heapK.push(k);
  heapC.push(c);
  while (i > 0) {
    const p = (i - 1) >> 1;
    if (!before(k, c, heapK[p]!, heapC[p]!)) break;
    heapK[i] = heapK[p]!;
    heapC[i] = heapC[p]!;
    i = p;
  }
  heapK[i] = k;
  heapC[i] = c;
}

/** Removes the top entry and returns its cell. */
function pop(): number {
  const top = heapC[0]!;
  const lastK = heapK.pop()!, lastC = heapC.pop()!;
  const n = heapK.length;
  if (n > 0) {
    let i = 0;
    for (;;) {
      let c = 2 * i + 1;
      if (c >= n) break;
      if (c + 1 < n && before(heapK[c + 1]!, heapC[c + 1]!, heapK[c]!, heapC[c]!)) c++;
      if (!before(heapK[c]!, heapC[c]!, lastK, lastC)) break;
      heapK[i] = heapK[c]!;
      heapC[i] = heapC[c]!;
      i = c;
    }
    heapK[i] = lastK;
    heapC[i] = lastC;
  }
  return top;
}
