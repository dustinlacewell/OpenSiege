import { test } from "node:test";
import assert from "node:assert/strict";
import { buildWaterGrid, growthFor, WATER_COARSE_STEPS, WATER_FINE_SPACING, WATER_FINE_STEPS, waterAxis, waterReach } from "../src/render/waterMesh.ts";
import { ringsFor } from "../src/render/surround.ts";

const axis = (reach: number): number[] => waterAxis(reach, WATER_FINE_SPACING, WATER_FINE_STEPS, WATER_COARSE_STEPS);

test("waterAxis runs -reach..reach, strictly increasing and symmetric about 0", () => {
  const a = axis(64000);
  assert.equal(a[0], -64000);
  assert.equal(a[a.length - 1], 64000);
  assert.equal(a.length, 2 * (WATER_FINE_STEPS + WATER_COARSE_STEPS) + 1);
  for (let i = 1; i < a.length; i++) assert.ok(a[i]! > a[i - 1]!);
  for (let i = 0; i < a.length; i++) assert.ok(Math.abs(a[i]! + a[a.length - 1 - i]!) < 1e-6);
});

test("waterAxis keeps the fine spacing in the core, then each step grows", () => {
  const a = axis(64000);
  const mid = (a.length - 1) / 2;
  for (let k = 1; k <= WATER_FINE_STEPS; k++) assert.ok(Math.abs(a[mid + k]! - a[mid + k - 1]! - WATER_FINE_SPACING) < 1e-9);
  for (let k = WATER_FINE_STEPS + 2; k <= WATER_FINE_STEPS + WATER_COARSE_STEPS - 1; k++) {
    assert.ok(a[mid + k]! - a[mid + k - 1]! > a[mid + k - 1]! - a[mid + k - 2]!);
  }
});

test("waterAxis with a reach inside the core ends at the core", () => {
  const a = axis(1000);
  assert.equal(a[a.length - 1], WATER_FINE_SPACING * WATER_FINE_STEPS);
});

test("growthFor solves the geometric sum, and is 1 when uniform steps already cover the span", () => {
  const g = growthFor(60000, 32, 64);
  const sum = (32 * g * (g ** 64 - 1)) / (g - 1);
  assert.ok(Math.abs(sum - 60000) < 1e-3);
  assert.equal(growthFor(1000, 32, 64), 1);
});

test("waterReach covers the mirrored surround from any point on the map", () => {
  const w = 16000, h = 12000;
  const reach = waterReach(w, h);
  const rings = ringsFor(w, h);
  // The surround spans -rings·w .. (rings + 1)·w; a centre at either map edge must still reach both ends.
  assert.ok(reach >= (rings + 1) * w);
  assert.ok(reach >= (rings + 1) * h);
});

test("buildWaterGrid lays out side² vertices and two in-range triangles per cell", () => {
  const g = buildWaterGrid([-2, -1, 0, 1, 2]);
  assert.equal(g.side, 5);
  assert.equal(g.positions.length, 25 * 2);
  assert.equal(g.indices.length, 16 * 6);
  assert.deepEqual([g.positions[0], g.positions[1]], [-2, -2]);
  assert.deepEqual([g.positions[48], g.positions[49]], [2, 2]);
  assert.ok(g.indices.every((i) => i < 25));
});

test("the default grid stays near 100k vertices", () => {
  const g = buildWaterGrid(axis(waterReach(16000, 16000)));
  assert.equal(g.side, 321);
  assert.equal(g.positions.length / 2, 103041);
  assert.equal(g.indices.length / 3, 204800);
});
