import { test } from "node:test";
import assert from "node:assert/strict";
import { clearLine, type Terrain } from "../src/index.ts";
import { freshState, TINY } from "./helpers.ts";

/** TINY flattened to 0, with an optional north-south ridge of height `ridge` on the vertex column at x = 1000. */
function ground(ridge = 0): Terrain {
  const t = freshState(1, TINY, (spec) => spec.heights.fill(0)).world.terrain;
  const ix = 1000 / t.cell;
  for (let iy = 0; iy < t.rows; iy++) t.heights[iy * t.cols + ix] = ridge;
  return t;
}

test("a line over flat ground is clear", () => {
  assert.equal(clearLine(ground(), 200, 1000, 10, 1800, 1000, 10), true);
});

test("a ridge between two low points blocks the line", () => {
  assert.equal(clearLine(ground(500), 200, 1000, 10, 1800, 1000, 10), false);
});

test("a high eye sees over the ridge", () => {
  assert.equal(clearLine(ground(500), 200, 1000, 2000, 1800, 1000, 10), true);
});
