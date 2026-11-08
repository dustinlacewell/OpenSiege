import { test } from "node:test";
import assert from "node:assert/strict";
import { TERRAIN_MAX_HEIGHT } from "@mf/sim";
import { applyChanges, brushWeight, heightBrush, type Brush, type HeightGrid } from "../src/index.ts";

const grid = (h = 100): HeightGrid => ({ cols: 9, rows: 9, cell: 100, heights: new Array(81).fill(h) });
const at = (x: number, y: number, extra: Partial<Brush> = {}): Brush => ({ x, y, radius: 250, strength: 50, falloff: 0.5, ...extra });

test("weight is 1 in the solid core, 0 at the rim, falls between", () => {
  assert.equal(brushWeight(0, 100, 0.5), 1);
  assert.equal(brushWeight(50, 100, 0.5), 1);
  assert.equal(brushWeight(100, 100, 0.5), 0);
  const mid = brushWeight(75, 100, 0.5);
  assert.ok(mid > 0 && mid < 1);
  assert.equal(brushWeight(99, 100, 0), 1);
});

test("raise lifts the centre most and leaves far cells alone", () => {
  const g = grid();
  const ch = heightBrush(g, "raise", at(400, 400));
  const centre = ch.find((c) => c.index === 4 * 9 + 4)!;
  assert.equal(centre.after, 150);
  assert.ok(ch.every((c) => c.after >= c.before));
  assert.ok(!ch.some((c) => c.index === 0));
});

test("the grid is not mutated; changes undo to the original", () => {
  const g = grid();
  const copy = [...g.heights];
  const ch = heightBrush(g, "lower", at(400, 400));
  assert.deepEqual([...g.heights], copy);
  const h = [...g.heights];
  applyChanges(h, ch, "after");
  assert.notDeepEqual(h, copy);
  applyChanges(h, ch, "before");
  assert.deepEqual(h, copy);
});

test("heights clamp to 0..max and stay integers", () => {
  const lo = heightBrush(grid(10), "lower", at(400, 400, { strength: 500 }));
  assert.ok(lo.every((c) => c.after === 0));
  const hi = heightBrush(grid(TERRAIN_MAX_HEIGHT - 5), "raise", at(400, 400, { strength: 500 }));
  assert.ok(hi.every((c) => c.after === TERRAIN_MAX_HEIGHT));
  const odd = heightBrush(grid(), "raise", at(430, 410, { strength: 7.3 }));
  assert.ok(odd.every((c) => Number.isInteger(c.after)));
});

test("flatten pulls cells toward the target", () => {
  const g = grid(300);
  const ch = heightBrush(g, "flatten", at(400, 400, { target: 100, strength: 900 }));
  assert.ok(ch.length > 0);
  assert.ok(ch.every((c) => c.after < c.before && c.after >= 100));
});

test("smooth reduces a spike", () => {
  const g = grid(100);
  (g.heights as number[])[4 * 9 + 4] = 400;
  const ch = heightBrush(g, "smooth", at(400, 400, { strength: 10, radius: 150, falloff: 0 }));
  const spike = ch.find((c) => c.index === 4 * 9 + 4)!;
  assert.ok(spike.after < 400);
});

test("noise is deterministic per seed and differs between seeds", () => {
  const g = grid();
  const a = heightBrush(g, "noise", at(400, 400, { seed: 1 }));
  const b = heightBrush(g, "noise", at(400, 400, { seed: 1 }));
  const c = heightBrush(g, "noise", at(400, 400, { seed: 2 }));
  assert.deepEqual(a, b);
  assert.notDeepEqual(a, c);
});

test("a dab at the map corner stays inside the grid", () => {
  const ch = heightBrush(grid(), "raise", at(0, 0));
  assert.ok(ch.every((c) => c.index >= 0 && c.index < 81));
});
