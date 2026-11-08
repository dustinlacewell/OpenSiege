import { heightAt, type Terrain } from "@mf/sim";
import { smoothNormal } from "./terrainSampling.ts";

/** Sim vertices a mesh vertex reads, each way: bilinear height reaches one, the bicubic normal two, plus the normal's step. */
const REACH = 3;

export interface TerrainMesh {
  /** Interleaved position (3) and normal (3). */
  vertices: Float32Array;
  indices: Uint32Array;
  /** World coordinate of each mesh column and row. */
  xs: number[];
  ys: number[];
  /** Mesh vertices per sim cell, along each axis. */
  subdiv: number;
}

/** Mesh rows `r0..r1`, inclusive. Rows are contiguous in `vertices`, so the span uploads in one call. */
export interface MeshRows {
  r0: number;
  r1: number;
}

/** A rectangle of sim vertex indices, inclusive. */
export interface SimRect {
  i0: number;
  j0: number;
  i1: number;
  j1: number;
}

/**
 * A grid `subdiv` times finer than the sim's, over exactly the map. Heights come from the sim's bilinear
 * `heightAt`, so units sit exactly on the drawn ground; normals come from a smooth bicubic surface. Along an
 * edge the heights are linear between sim vertices at any `subdiv`, so a fine mesh and a coarse one meet with
 * no gap.
 */
export function buildTerrainMesh(t: Terrain, subdiv: number): TerrainMesh {
  const xs = gridAxis((t.cols - 1) * t.cell, (t.cols - 1) * subdiv);
  const ys = gridAxis((t.rows - 1) * t.cell, (t.rows - 1) * subdiv);
  const mesh = { vertices: new Float32Array(xs.length * ys.length * 6), indices: gridIndices(xs.length, ys.length), xs, ys, subdiv };
  writeBlock(mesh, t, 0, xs.length - 1, 0, ys.length - 1);
  return mesh;
}

/** Rewrites the mesh vertices that read the changed sim vertices, in place. Returns the rows to upload, or null. */
export function refreshTerrainMesh(mesh: TerrainMesh, t: Terrain, r: SimRect): MeshRows | null {
  const cols = axisRange(mesh.xs, r.i0, r.i1, t.cell);
  const rows = axisRange(mesh.ys, r.j0, r.j1, t.cell);
  if (!cols || !rows) return null;
  writeBlock(mesh, t, cols[0], cols[1], rows[0], rows[1]);
  return { r0: rows[0], r1: rows[1] };
}

/** Mesh indices along one axis whose coordinate lies within REACH sim cells of `k0..k1`. */
function axisRange(axis: number[], k0: number, k1: number, cell: number): [number, number] | null {
  const lo = (k0 - REACH) * cell;
  const hi = (k1 + REACH) * cell;
  let a = 0;
  while (a < axis.length && axis[a]! < lo) a++;
  let b = axis.length - 1;
  while (b >= 0 && axis[b]! > hi) b--;
  return a <= b ? [a, b] : null;
}

function writeBlock(mesh: TerrainMesh, t: Terrain, i0: number, i1: number, j0: number, j1: number): void {
  const { vertices, xs, ys } = mesh;
  const w = xs.length;
  const h = t.cell / mesh.subdiv;
  for (let j = j0; j <= j1; j++) {
    for (let i = i0; i <= i1; i++) writeVertex(vertices, (j * w + i) * 6, t, xs[i]!, ys[j]!, h);
  }
}

/** Coordinates along one axis of `span` world units cut into `n` steps. */
function gridAxis(span: number, n: number): number[] {
  return Array.from({ length: n + 1 }, (_, k) => (k * span) / n);
}

function writeVertex(out: Float32Array, o: number, t: Terrain, x: number, y: number, h: number): void {
  out[o] = x;
  out[o + 1] = y;
  out[o + 2] = heightAt(t, x, y);
  smoothNormal(t, x, y, h, out, o + 3);
}

function gridIndices(w: number, d: number): Uint32Array {
  const out = new Uint32Array((w - 1) * (d - 1) * 6);
  let k = 0;
  for (let j = 0; j < d - 1; j++) {
    for (let i = 0; i < w - 1; i++) {
      const a = j * w + i;
      const b = a + 1;
      const c = a + w;
      const d = c + 1;
      out[k++] = a; out[k++] = c; out[k++] = b;
      out[k++] = b; out[k++] = c; out[k++] = d;
    }
  }
  return out;
}
