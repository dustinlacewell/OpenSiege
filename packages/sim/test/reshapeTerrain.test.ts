import assert from "node:assert/strict";
import { test } from "node:test";
import { createSimState, type VertexBox } from "../src/index.ts";
import { MOVE_CLASSES } from "../src/nav/moveClass.ts";
import { reshapeTerrain } from "../src/nav/reshapeTerrain.ts";
import { freshState, TINY } from "./helpers.ts";

function lower(s: ReturnType<typeof freshState>, box: VertexBox, by: number): void {
  const t = s.world.terrain;
  for (let j = box.j0; j <= box.j1; j++) for (let i = box.i0; i <= box.i1; i++) t.heights[j * t.cols + i]! -= by;
}

test("a steep pit gives the nav of a fresh build (grids and region labels, exactly)", () => {
  const s = freshState(1, TINY);
  const box: VertexBox = { i0: 5, j0: 5, i1: 7, j1: 7 };
  lower(s, box, 2000);
  reshapeTerrain(s.nav, s.world.terrain, [box]);
  const fresh = createSimState(s.world).nav;
  for (const cls of MOVE_CLASSES) {
    assert.deepEqual(s.nav.grids[cls], fresh.grids[cls]);
    // labelRegions numbers regions by first cell in index order, so equal partitions have equal labels.
    assert.deepEqual(s.nav.regions[cls], fresh.regions[cls]);
  }
});

test("a tiny dent flips no cell and keeps the regions arrays", () => {
  const s = freshState(1, TINY);
  const before = { ...s.nav.regions };
  const box: VertexBox = { i0: 5, j0: 5, i1: 5, j1: 5 };
  const grids = MOVE_CLASSES.map((c) => s.nav.grids[c].slice());
  lower(s, box, 1);
  reshapeTerrain(s.nav, s.world.terrain, [box]);
  MOVE_CLASSES.forEach((c, k) => {
    assert.equal(s.nav.regions[c], before[c]);
    assert.deepEqual(s.nav.grids[c], grids[k]);
  });
});

test("boxes at the first and last vertex stay in bounds and match a fresh build", () => {
  const s = freshState(1, TINY);
  const t = s.world.terrain;
  const first: VertexBox = { i0: 0, j0: 0, i1: 0, j1: 0 };
  const last: VertexBox = { i0: t.cols - 1, j0: t.rows - 1, i1: t.cols - 1, j1: t.rows - 1 };
  lower(s, first, 2000);
  lower(s, last, 2000);
  reshapeTerrain(s.nav, t, [first, last]);
  const fresh = createSimState(s.world).nav;
  for (const cls of MOVE_CLASSES) {
    assert.equal(s.nav.grids[cls].length, fresh.grids[cls].length);
    assert.deepEqual(s.nav.grids[cls], fresh.grids[cls]);
    assert.deepEqual(s.nav.regions[cls], fresh.regions[cls]);
  }
});
