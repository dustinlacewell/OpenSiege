import assert from "node:assert/strict";
import { test } from "node:test";
import type { Terrain } from "@mf/sim";
import { SightGrid } from "../src/game/sightGrid.ts";

const flat = (cols: number, rows: number, cell: number): Terrain => ({ cols, rows, cell, heights: new Array(cols * rows).fill(0), seaLevel: 0 });

test("the grid takes the shape of the terrain, cell for cell", () => {
  const g = new SightGrid();
  g.useTerrain(flat(9, 5, 100));
  assert.equal(g.cols, 8);
  assert.equal(g.rows, 4);
  assert.equal(g.seen.length, 32);
});

test("the grid reallocates when the next terrain has another size", () => {
  const g = new SightGrid();
  g.useTerrain(flat(9, 5, 100));
  g.useTerrain(flat(5, 17, 50));
  assert.equal(g.cols, 4);
  assert.equal(g.rows, 16);
  assert.equal(g.seen.length, 64);
});

test("the grid keeps its buffer when a same-size terrain arrives", () => {
  const g = new SightGrid();
  g.useTerrain(flat(9, 5, 100));
  const seen = g.seen;
  g.useTerrain(flat(9, 5, 100));
  assert.equal(g.seen, seen);
});

test("a viewer sees along the long side of a wide map and not past the edge", () => {
  const g = new SightGrid();
  g.useTerrain(flat(41, 5, 100)); // 4000 x 400
  g.fill(false);
  g.mark(2000, 200, 50, 1000);
  assert.ok(g.sees(2900, 200));
  assert.ok(!g.sees(3500, 200));
  assert.ok(g.sees(2000, 380));
});

test("a viewer on a tall map marks cells by row stride", () => {
  const g = new SightGrid();
  g.useTerrain(flat(5, 41, 100)); // 400 x 4000
  g.fill(false);
  g.mark(200, 3000, 50, 500);
  assert.ok(g.sees(200, 3400));
  assert.ok(!g.sees(200, 2000));
  assert.ok(!g.sees(200, 3900));
});

/** What the viewer at (x, y) sees, as a fresh grid on this terrain. */
function seenFresh(t: Terrain, x: number, y: number, eye: number, sight: number): Uint8Array {
  const g = new SightGrid();
  g.useTerrain(t);
  g.fill(false);
  g.mark(x, y, eye, sight);
  return g.seen.slice();
}

test("refresh after heights are lowered in place matches a fresh grid", () => {
  const t = flat(21, 21, 100);
  const hill = [[10, 10], [11, 10], [10, 11], [11, 11], [9, 10], [9, 11]] as const;
  for (const [i, j] of hill) t.heights[j * 21 + i] = 400;
  const g = new SightGrid();
  g.useTerrain(t);
  g.fill(false);
  g.mark(300, 1050, 40, 1500);
  assert.ok(!g.sees(1600, 1050), "the hill blocks the far side");
  for (const [i, j] of hill) t.heights[j * 21 + i] = 0;
  g.refresh(t, { i0: 9, j0: 10, i1: 11, j1: 11 });
  g.fill(false);
  g.mark(300, 1050, 40, 1500);
  assert.ok(g.sees(1600, 1050), "the far side is open once the hill is gone");
  assert.deepEqual(g.seen, seenFresh(t, 300, 1050, 40, 1500));
});

test("refresh on a box at the map corner stays inside the grid", () => {
  const t = flat(5, 5, 100);
  const g = new SightGrid();
  g.useTerrain(t);
  t.heights[0] = -50;
  t.heights[24] = -50;
  g.refresh(t, { i0: 0, j0: 0, i1: 0, j1: 0 });
  g.refresh(t, { i0: 4, j0: 4, i1: 4, j1: 4 });
  g.fill(false);
  g.mark(200, 200, 40, 400);
  assert.deepEqual(g.seen, seenFresh(t, 200, 200, 40, 400));
});
