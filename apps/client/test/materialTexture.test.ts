import { test } from "node:test";
import assert from "node:assert/strict";
import { packPalette, srgbToLinear } from "../src/render/materialPalette.ts";
import { rectUploadPlan } from "../src/render/materialTexture.ts";

test("srgbToLinear maps the ends to 0 and 1 and matches the shader's 2.2 gamma", () => {
  assert.equal(srgbToLinear(0), 0);
  assert.equal(srgbToLinear(255), 1);
  assert.ok(Math.abs(srgbToLinear(128) - Math.pow(128 / 255, 2.2)) < 1e-12);
});

test("srgbToLinear clamps out-of-range input", () => {
  assert.equal(srgbToLinear(-10), 0);
  assert.equal(srgbToLinear(300), 1);
});

test("packPalette writes four linear vec3s in channel order", () => {
  const out = packPalette([[255, 0, 0], [0, 255, 0], [0, 0, 255], [255, 255, 255]]);
  assert.deepEqual([...out], [1, 0, 0, 0, 1, 0, 0, 0, 1, 1, 1, 1]);
});

test("rectUploadPlan turns inclusive bounds into offset, size and the full row stride", () => {
  assert.deepEqual(rectUploadPlan(10, 8, { i0: 2, j0: 3, i1: 4, j1: 3 }), { x: 2, y: 3, width: 3, height: 1, rowLength: 10 });
});

test("rectUploadPlan clamps to the grid", () => {
  assert.deepEqual(rectUploadPlan(10, 8, { i0: -3, j0: -1, i1: 20, j1: 99 }), { x: 0, y: 0, width: 10, height: 8, rowLength: 10 });
});

test("rectUploadPlan returns null when the rect misses the grid or is inverted", () => {
  assert.equal(rectUploadPlan(10, 8, { i0: 12, j0: 0, i1: 15, j1: 2 }), null);
  assert.equal(rectUploadPlan(10, 8, { i0: 5, j0: 0, i1: 4, j1: 2 }), null);
});
