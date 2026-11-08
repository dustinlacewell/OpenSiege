import { test } from "node:test";
import assert from "node:assert/strict";
import type { Terrain } from "@mf/sim";
import { GROUND_WATCH_WINDOW, GroundWatch } from "../src/render/groundWatch.ts";

function terrain(n: number): Terrain {
  return { cols: n, rows: 1, cell: 100, heights: new Array(n).fill(10), seaLevel: 60 };
}

test("the first terrain and a new terrain object are new", () => {
  const w = new GroundWatch();
  const a = terrain(4);
  assert.equal(w.check(a), "new");
  assert.equal(w.check(a), "same");
  assert.equal(w.check(terrain(4)), "new");
});

test("a height changed in place is found", () => {
  const w = new GroundWatch();
  const t = terrain(4);
  w.check(t);
  t.heights[2] = 5;
  assert.equal(w.check(t), "changed");
  assert.equal(w.check(t), "same");
});

test("a sea level change is found at once", () => {
  const w = new GroundWatch();
  const t = terrain(4);
  w.check(t);
  t.seaLevel = 70;
  assert.equal(w.check(t), "changed");
});

test("on a grid bigger than the window, a change is found within one walk of the grid", () => {
  const n = GROUND_WATCH_WINDOW * 3 + 5;
  const w = new GroundWatch();
  const t = terrain(n);
  w.check(t);
  t.heights[n - 1] = 0;
  const results: string[] = [];
  for (let i = 0; i < 4; i++) results.push(w.check(t));
  assert.deepEqual(results, ["same", "same", "same", "changed"]);
});
