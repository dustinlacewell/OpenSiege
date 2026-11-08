import { BLOCKED, colOf, rowOf, type NavGrid, type NavShape } from "./navGrid.ts";

/**
 * True when no cell the segment (x0, y0) to (x1, y1) touches is blocked.
 * Exact grid walk (a supercover): the cells come in order from the start. Where the segment runs through a
 * cell corner, both cells beside the corner count too, so no corner is cut unseen. Integer only.
 */
export function clearLine(s: NavShape, grid: NavGrid, x0: number, y0: number, x1: number, y1: number): boolean {
  const dx = x1 - x0, dy = y1 - y0;
  const stepX = dx >= 0 ? 1 : -1, stepY = dy >= 0 ? 1 : -1;
  const absX = Math.abs(dx), absY = Math.abs(dy);
  const endX = colOf(s, x1), endY = rowOf(s, y1);
  let cx = colOf(s, x0), cy = rowOf(s, y0);
  const bad = (x: number, y: number): boolean => grid[y * s.cols + x] === BLOCKED;
  if (bad(cx, cy)) return false;
  while (cx !== endX || cy !== endY) {
    // Compare how far along the segment each next cell edge is, cross-multiplied to stay integer.
    const alongX = cx === endX ? Infinity : Math.abs(edge(s, cx, stepX) - x0) * absY;
    const alongY = cy === endY ? Infinity : Math.abs(edge(s, cy, stepY) - y0) * absX;
    if (alongX < alongY) {
      cx += stepX;
    } else if (alongY < alongX) {
      cy += stepY;
    } else {
      if (bad(cx + stepX, cy) || bad(cx, cy + stepY)) return false;
      cx += stepX;
      cy += stepY;
    }
    if (bad(cx, cy)) return false;
  }
  return true;
}

/** World coordinate of the edge of cell c on the side the walk leaves by. */
function edge(s: NavShape, c: number, step: number): number {
  return (step > 0 ? c + 1 : c) * s.cell;
}
