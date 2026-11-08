import assert from "node:assert/strict";
import { test } from "node:test";
import { PROJ_FP } from "../src/stats.ts";
import { MAX_DIG, stampCrater } from "../src/terrain/crater.ts";
import { seaLevelOf } from "../src/terrain/water.ts";
import type { Blast, Terrain } from "../src/types.ts";

const N = 9, CELL = 125;

function flat(height = 500): { terrain: Terrain; dug: number[] } {
  const heights = new Array<number>(N * N).fill(height);
  return { terrain: { cols: N, rows: N, cell: CELL, heights, seaLevel: seaLevelOf(heights) }, dug: new Array<number>(N * N).fill(0) };
}

const DIG = 15;

/** Blast at vertex (4, 4) unless moved; z is height above sea level. */
function blast(over: Partial<Blast> = {}): Blast {
  return { x: 4 * CELL * PROJ_FP, y: 4 * CELL * PROJ_FP, z: 500 * PROJ_FP, damage: 0, dig: DIG, radius: 300, owner: -1, ...over };
}

const at = (i: number, j: number) => j * N + i;

test("ground blast lowers the centre most and spares vertices at the radius", () => {
  const { terrain, dug } = flat();
  assert.ok(stampCrater(terrain, dug, blast()));
  const centre = 500 - terrain.heights[at(4, 4)]!;
  assert.equal(centre, DIG);
  assert.ok(centre > 500 - terrain.heights[at(5, 4)]!);
  assert.ok(500 - terrain.heights[at(5, 4)]! > 0);
  // radius 300: vertex 3 cells away (375) is outside, 2 cells (250) is inside.
  assert.equal(terrain.heights[at(7, 4)], 500);
  assert.notEqual(terrain.heights[at(6, 4)], 500);
  const exact = flat();
  stampCrater(exact.terrain, exact.dug, blast({ radius: 250 }));
  assert.equal(exact.terrain.heights[at(6, 4)], 500);
});

test("blast high above the ground changes nothing", () => {
  const { terrain, dug } = flat();
  assert.equal(stampCrater(terrain, dug, blast({ z: 800 * PROJ_FP })), null);
  assert.ok(terrain.heights.every((v) => v === 500));
  assert.ok(dug.every((v) => v === 0));
});

test("repeated blasts stop at MAX_DIG", () => {
  const { terrain, dug } = flat();
  for (let n = 0; n < 50; n++) stampCrater(terrain, dug, blast({ z: terrain.heights[at(4, 4)]! * PROJ_FP }));
  assert.equal(dug[at(4, 4)], MAX_DIG);
  assert.equal(terrain.heights[at(4, 4)], 500 - MAX_DIG);
});

test("a low vertex stops at 0", () => {
  const { terrain, dug } = flat(5);
  stampCrater(terrain, dug, blast({ z: 5 * PROJ_FP }));
  assert.equal(terrain.heights[at(4, 4)], 0);
  assert.equal(dug[at(4, 4)], 5);
  assert.ok(terrain.heights.every((v) => v >= 0));
});

test("returned box holds every changed vertex and no more", () => {
  const { terrain, dug } = flat();
  const before = terrain.heights.slice();
  const box = stampCrater(terrain, dug, blast({ x: 3 * CELL * PROJ_FP, y: 2 * CELL * PROJ_FP + 40 * PROJ_FP, radius: 300 }))!;
  let i0 = N, j0 = N, i1 = -1, j1 = -1;
  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) {
      if (terrain.heights[at(i, j)] === before[at(i, j)]) continue;
      i0 = Math.min(i0, i); j0 = Math.min(j0, j); i1 = Math.max(i1, i); j1 = Math.max(j1, j);
    }
  }
  assert.deepEqual(box, { i0, j0, i1, j1 });
});

test("a blast at the map corner stays inside the grid", () => {
  const { terrain, dug } = flat();
  const box = stampCrater(terrain, dug, blast({ x: 0, y: 0 }))!;
  assert.equal(box.i0, 0);
  assert.equal(box.j0, 0);
});

test("radius 0 still dents, using one cell", () => {
  const { terrain, dug } = flat();
  const box = stampCrater(terrain, dug, blast({ radius: 0 }));
  assert.ok(box);
  assert.ok(terrain.heights[at(4, 4)]! < 500);
});
