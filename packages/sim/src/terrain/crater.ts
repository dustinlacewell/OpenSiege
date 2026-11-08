import { PROJ_FP } from "../stats.ts";
import { heightAt } from "../terrain.ts";
import type { Blast, Terrain, VertexBox } from "../types.ts";

/** Most a vertex may go below its starting height. */
export const MAX_DIG = 24;

/**
 * Dent the ground under a blast: a bowl, `blast.dig` deep at the centre. Lowers `terrain.heights` and raises `dug` in place.
 * Returns the box of vertices it changed, or null. Integer math; products stay far below 2^53 (dig ≤ 100, radius ≤ 2000).
 */
export function stampCrater(terrain: Terrain, dug: number[], blast: Blast): VertexBox | null {
  const { cols, rows, cell, heights } = terrain;
  const cx = Math.floor(blast.x / PROJ_FP), cy = Math.floor(blast.y / PROJ_FP);
  const h = Math.max(0, Math.floor(blast.z / PROJ_FP) - heightAt(terrain, cx, cy));
  const r = Math.max(blast.radius, cell);
  if (h >= r) return null;
  const depth = Math.floor((blast.dig * (r - h)) / r);
  if (depth <= 0) return null;

  const r2 = r * r;
  const i0 = Math.max(0, Math.ceil((cx - r) / cell)), i1 = Math.min(cols - 1, Math.floor((cx + r) / cell));
  const j0 = Math.max(0, Math.ceil((cy - r) / cell)), j1 = Math.min(rows - 1, Math.floor((cy + r) / cell));
  let box: VertexBox | null = null;
  for (let j = j0; j <= j1; j++) {
    for (let i = i0; i <= i1; i++) {
      const dx = i * cell - cx, dy = j * cell - cy;
      const d2 = dx * dx + dy * dy;
      if (d2 >= r2) continue;
      const v = j * cols + i;
      const drop = Math.min(Math.floor((depth * (r2 - d2)) / r2), MAX_DIG - dug[v]!, heights[v]!);
      if (drop <= 0) continue;
      heights[v] = heights[v]! - drop;
      dug[v] = dug[v]! + drop;
      box = box ? growBox(box, i, j) : { i0: i, j0: j, i1: i, j1: j };
    }
  }
  return box;
}

function growBox(b: VertexBox, i: number, j: number): VertexBox {
  return { i0: Math.min(b.i0, i), j0: Math.min(b.j0, j), i1: Math.max(b.i1, i), j1: Math.max(b.j1, j) };
}
