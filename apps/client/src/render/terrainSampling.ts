import type { Terrain } from "@mf/sim";

/**
 * Catmull-Rom height at world (x, y): a C1 surface through every terrain vertex.
 * Only for shading normals; positions use the sim's bilinear `heightAt` so units sit on the drawn ground.
 */
export function smoothHeightAt(t: Terrain, x: number, y: number): number {
  const gx = x / t.cell;
  const gy = y / t.cell;
  const i = Math.floor(gx);
  const j = Math.floor(gy);
  const fx = gx - i;
  const fy = gy - j;
  return catmull(row(t, i, j - 1, fx), row(t, i, j, fx), row(t, i, j + 1, fx), row(t, i, j + 2, fx), fy);
}

/** Unit normal of the smooth surface by central differences `h` apart. Writes x, y, z at out[o..o+2]. */
export function smoothNormal(t: Terrain, x: number, y: number, h: number, out: Float32Array, o: number): void {
  const dx = (smoothHeightAt(t, x + h, y) - smoothHeightAt(t, x - h, y)) / (2 * h);
  const dy = (smoothHeightAt(t, x, y + h) - smoothHeightAt(t, x, y - h)) / (2 * h);
  const len = Math.hypot(dx, dy, 1);
  out[o] = -dx / len;
  out[o + 1] = -dy / len;
  out[o + 2] = 1 / len;
}

function row(t: Terrain, i: number, j: number, f: number): number {
  return catmull(vertex(t, i - 1, j), vertex(t, i, j), vertex(t, i + 1, j), vertex(t, i + 2, j), f);
}

function catmull(p0: number, p1: number, p2: number, p3: number, f: number): number {
  const f2 = f * f;
  const f3 = f2 * f;
  return 0.5 * (2 * p1 + (p2 - p0) * f + (2 * p0 - 5 * p1 + 4 * p2 - p3) * f2 + (3 * p1 - p0 - 3 * p2 + p3) * f3);
}

/** Vertex height, reflected across the map edge like the mirrored surround, so edge normals match it. */
function vertex(t: Terrain, i: number, j: number): number {
  return t.heights[reflect(j, t.rows) * t.cols + reflect(i, t.cols)] ?? 0;
}

/** Index `k` reflected into `0..n-1` about the end vertices (-1 reads 1). Reaches only one map width past an edge. */
function reflect(k: number, n: number): number {
  const r = k < 0 ? -k : k > n - 1 ? 2 * (n - 1) - k : k;
  return Math.min(n - 1, Math.max(0, r));
}
