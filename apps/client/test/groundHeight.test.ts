import { test } from "node:test";
import assert from "node:assert/strict";
import { copyHeightRect } from "../src/render/groundHeight.ts";
import { rectUploadPlan } from "../src/render/materialTexture.ts";

test("copyHeightRect copies only the planned vertices, in place", () => {
  const cols = 4, rows = 3;
  const heights = Array.from({ length: cols * rows }, (_, i) => i + 1);
  const out = new Float32Array(cols * rows);
  copyHeightRect(heights, rectUploadPlan(cols, rows, { i0: 1, j0: 1, i1: 2, j1: 2 })!, out);
  assert.deepEqual([...out], [0, 0, 0, 0, 0, 6, 7, 0, 0, 10, 11, 0]);
});

test("copyHeightRect over the full plan copies everything", () => {
  const heights = [5, 4, 3, 2, 1, 0];
  const out = new Float32Array(6);
  copyHeightRect(heights, rectUploadPlan(3, 2, { i0: 0, j0: 0, i1: 2, j1: 1 })!, out);
  assert.deepEqual([...out], heights);
});
