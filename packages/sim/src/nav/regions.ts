import { BLOCKED, type NavGrid, type NavShape } from "./navGrid.ts";

/** One label per cell. Uint32, so any allowed map (under 2^18 cells) fits. */
export type Regions = Uint32Array;

/**
 * Connected regions of open cells: a label per cell, 1 up in index order of each region's first cell; 0 for blocked.
 * Two open cells share a label exactly when the path search can lead one to the other. A diagonal step needs
 * both cells beside it open, so 4-neighbour connection gives the same regions.
 */
export function labelRegions(s: NavShape, grid: NavGrid): Regions {
  const cells = s.cols * s.rows;
  const labels = new Uint32Array(cells);
  let next = 0;
  for (let start = 0; start < cells; start++) {
    if (grid[start] === BLOCKED || labels[start] !== 0) continue;
    flood(s, grid, labels, start, ++next);
  }
  return labels;
}

function flood(s: NavShape, grid: NavGrid, labels: Regions, start: number, label: number): void {
  const cols = s.cols, cells = cols * s.rows;
  const stack = [start];
  labels[start] = label;
  while (stack.length > 0) {
    const c = stack.pop()!;
    const x = c % cols;
    if (x > 0) visit(grid, labels, c - 1, label, stack);
    if (x < cols - 1) visit(grid, labels, c + 1, label, stack);
    if (c >= cols) visit(grid, labels, c - cols, label, stack);
    if (c < cells - cols) visit(grid, labels, c + cols, label, stack);
  }
}

function visit(grid: NavGrid, labels: Regions, n: number, label: number, stack: number[]): void {
  if (grid[n] === BLOCKED || labels[n] !== 0) return;
  labels[n] = label;
  stack.push(n);
}
