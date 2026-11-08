import type { Terrain, VertexBox, World } from "@mf/sim";

/** A cell steeper than this (height change per unit across the cell) is bare ground and rock. */
const MAX_GRADIENT = 0.3;
/** Scatter keeps this far, in world units, from a resource field's rim. */
const FIELD_MARGIN = 60;
/** A tree's leaves overhang its radius by about this factor. */
const FEATURE_REACH = 1.8;

/**
 * One byte per terrain cell, 1 where scatter must not grow: steep ground, resource fields, and under
 * features. Row-major, `cols - 1` by `rows - 1` cells. Pure: same world, same mask.
 */
export function scatterMask(world: Pick<World, "terrain" | "features" | "fields">): Uint8Array {
  const t = world.terrain;
  const mask = new Uint8Array((t.cols - 1) * (t.rows - 1));
  fillCells(mask, world, { i0: 0, j0: 0, i1: t.cols - 2, j1: t.rows - 2 });
  return mask;
}

/**
 * The heights in this vertex box changed in place: recompute the cells that read them, leaving the rest.
 * Gives the same mask as `scatterMask` on the changed world.
 */
export function refreshScatterMask(mask: Uint8Array, world: Pick<World, "terrain" | "features" | "fields">, box: VertexBox): void {
  const t = world.terrain;
  const cells = { i0: Math.max(0, box.i0 - 1), j0: Math.max(0, box.j0 - 1), i1: Math.min(t.cols - 2, box.i1), j1: Math.min(t.rows - 2, box.j1) };
  for (let j = cells.j0; j <= cells.j1; j++) mask.fill(0, j * (t.cols - 1) + cells.i0, j * (t.cols - 1) + cells.i1 + 1);
  fillCells(mask, world, cells);
}

/** Marks steep ground, fields and features within an inclusive cell box. */
function fillCells(mask: Uint8Array, world: Pick<World, "terrain" | "features" | "fields">, c: CellBox): void {
  const t = world.terrain;
  markSteep(mask, t, c);
  for (const f of world.fields) markDisc(mask, t, f.x, f.y, f.radius + FIELD_MARGIN, c);
  for (const f of world.features) markDisc(mask, t, f.x, f.y, f.radius * FEATURE_REACH, c);
}

interface CellBox { i0: number; j0: number; i1: number; j1: number }

function markSteep(mask: Uint8Array, t: Terrain, box: CellBox): void {
  const cells = t.cols - 1;
  const limit = MAX_GRADIENT * t.cell;
  for (let j = box.j0; j <= box.j1; j++) {
    for (let i = box.i0; i <= box.i1; i++) {
      const a = t.heights[j * t.cols + i]!, b = t.heights[j * t.cols + i + 1]!;
      const c = t.heights[(j + 1) * t.cols + i]!, d = t.heights[(j + 1) * t.cols + i + 1]!;
      if (Math.max(a, b, c, d) - Math.min(a, b, c, d) > limit) mask[j * cells + i] = 1;
    }
  }
}

/** Marks every cell of `box` the disc touches. */
function markDisc(mask: Uint8Array, t: Terrain, x: number, y: number, radius: number, box: CellBox): void {
  const cells = t.cols - 1;
  const i0 = Math.max(box.i0, Math.floor((x - radius) / t.cell)), i1 = Math.min(box.i1, Math.floor((x + radius) / t.cell));
  const j0 = Math.max(box.j0, Math.floor((y - radius) / t.cell)), j1 = Math.min(box.j1, Math.floor((y + radius) / t.cell));
  for (let j = j0; j <= j1; j++) {
    for (let i = i0; i <= i1; i++) {
      if (touches(i, j, t.cell, x, y, radius)) mask[j * cells + i] = 1;
    }
  }
}

/** Does the disc reach the cell's square? */
function touches(i: number, j: number, cell: number, x: number, y: number, radius: number): boolean {
  const nx = Math.min(Math.max(x, i * cell), (i + 1) * cell);
  const ny = Math.min(Math.max(y, j * cell), (j + 1) * cell);
  return Math.hypot(x - nx, y - ny) <= radius;
}
