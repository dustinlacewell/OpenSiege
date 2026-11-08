import { heightAt, TERRAIN_MAX_HEIGHT, type Terrain } from "@mf/sim";
import { hash01 } from "../game/hash01.ts";
import { createPropInstance, type PropInstance } from "./propInstance.ts";
import { BUSH, DRY_TUFT, PEBBLES, TUFT } from "./scatterMeshes.ts";
import type { ScatterView } from "./scatterView.ts";

/** Receives each placed prop with its kind. `prop` is reused: copy out of it. */
export type ScatterSink = (kind: number, prop: PropInstance) => void;

/** Props per cell at most; a patch's density scales this down. */
const MAX_PER_CELL = 5;
/** Patches of meadow and bare ground are this many cells across. */
const PATCH = 8;
const PEBBLE_CHANCE = 0.1;
const BUSH_CHANCE = 0.06;
const TURN = Math.PI * 2;

/**
 * Places ground cover in the cells near `view`, skipping masked cells, up to `limit` props. Pure: a cell's
 * props come from the hash of its (i, j) alone, so every client sees the same ground and moving the window
 * never moves a prop.
 */
export function placeScatter(terrain: Terrain, mask: Uint8Array, view: ScatterView, limit: number, sink: ScatterSink): void {
  const cells = terrain.cols - 1, rowCells = terrain.rows - 1;
  const prop = createPropInstance();
  const reach = view.buildRadius + terrain.cell;
  const i0 = Math.max(0, Math.floor((view.cx - view.buildRadius) / terrain.cell));
  const i1 = Math.min(cells - 1, Math.floor((view.cx + view.buildRadius) / terrain.cell));
  const j0 = Math.max(0, Math.floor((view.cy - view.buildRadius) / terrain.cell));
  const j1 = Math.min(rowCells - 1, Math.floor((view.cy + view.buildRadius) / terrain.cell));
  let placed = 0;
  for (let j = j0; j <= j1; j++) {
    for (let i = i0; i <= i1; i++) {
      if (mask[j * cells + i]) continue;
      if (Math.hypot((i + 0.5) * terrain.cell - view.cx, (j + 0.5) * terrain.cell - view.cy) > reach) continue;
      placed += placeCell(terrain, i, j, prop, sink, limit - placed);
      if (placed >= limit) return;
    }
  }
}

/** Returns how many props the cell emitted. */
function placeCell(terrain: Terrain, i: number, j: number, prop: PropInstance, sink: ScatterSink, room: number): number {
  const density = hash01(Math.floor(i / PATCH), Math.floor(j / PATCH), 7);
  const count = Math.min(room, Math.floor(hash01(i, j, 0) * (1 + (MAX_PER_CELL - 1) * density)));
  for (let k = 0; k < count; k++) {
    const salt = 10 + k * 8;
    prop.x = (i + hash01(i, j, salt)) * terrain.cell;
    prop.y = (j + hash01(i, j, salt + 1)) * terrain.cell;
    prop.z = heightAt(terrain, prop.x, prop.y);
    prop.yaw = hash01(i, j, salt + 2) * TURN;
    prop.tint = hash01(i, j, salt + 3);
    const kind = pick(hash01(i, j, salt + 4), hash01(i, j, salt + 5), prop.z / TERRAIN_MAX_HEIGHT);
    size(kind, hash01(i, j, salt + 6), hash01(i, j, salt + 7), prop);
    sink(kind, prop);
  }
  return count;
}

/** Pebbles and bushes are rare; the rest is grass, drier up high. */
function pick(roll: number, dryRoll: number, height: number): number {
  if (roll < PEBBLE_CHANCE) return PEBBLES;
  if (roll < PEBBLE_CHANCE + BUSH_CHANCE) return BUSH;
  return dryRoll < smoothstep(0.25, 0.7, height) ? DRY_TUFT : TUFT;
}

/** World-unit size of each kind: [footprint min, spread, height min, spread]. */
const SIZES: readonly (readonly [number, number, number, number])[] = [
  [10, 8, 18, 12], // tuft
  [10, 8, 16, 10], // dry tuft
  [6, 6, 4, 5], // pebbles
  [16, 12, 20, 14], // bush
];

function size(kind: number, a: number, b: number, out: PropInstance): void {
  const [w, dw, h, dh] = SIZES[kind]!;
  out.scaleXY = w + dw * a;
  out.scaleZ = h + dh * b;
}

function smoothstep(lo: number, hi: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - lo) / (hi - lo)));
  return t * t * (3 - 2 * t);
}
