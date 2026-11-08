import assert from "node:assert/strict";
import { test } from "node:test";
import { TerrainWatch, unionBox } from "../src/game/terrainWatch.ts";

test("unionBox is the smallest box holding both", () => {
  assert.deepEqual(unionBox({ i0: 2, j0: 5, i1: 4, j1: 6 }, { i0: 3, j0: 1, i1: 9, j1: 5 }), { i0: 2, j0: 1, i1: 9, j1: 6 });
});

test("take returns the union of boxes noted across several steps", () => {
  const w = new TerrainWatch();
  w.note([{ i0: 10, j0: 10, i1: 12, j1: 12 }]);
  w.note([]);
  w.note([{ i0: 4, j0: 11, i1: 5, j1: 20 }, { i0: 11, j0: 2, i1: 30, j1: 3 }]);
  assert.deepEqual(w.take(), { i0: 4, j0: 2, i1: 30, j1: 20 });
});

test("take returns null after a take", () => {
  const w = new TerrainWatch();
  w.note([{ i0: 1, j0: 1, i1: 2, j1: 2 }]);
  w.take();
  assert.equal(w.take(), null);
});

test("with nothing noted, take returns null", () => {
  const w = new TerrainWatch();
  assert.equal(w.take(), null);
  w.note([]);
  assert.equal(w.take(), null);
});

test("note does not keep the caller's box", () => {
  const w = new TerrainWatch();
  const b = { i0: 1, j0: 1, i1: 2, j1: 2 };
  w.note([b]);
  w.note([{ i0: 0, j0: 0, i1: 0, j1: 0 }]);
  assert.deepEqual(b, { i0: 1, j0: 1, i1: 2, j1: 2 });
});
