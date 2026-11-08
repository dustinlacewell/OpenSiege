import assert from "node:assert/strict";
import { test } from "node:test";
import { minimapExtent, minimapScale, minimapWorld } from "../src/ui/minimapModel.ts";

test("a square map gives a square canvas", () => {
  const map = { width: 16000, height: 16000 };
  const e = minimapExtent(map, 200);
  assert.deepEqual(e, { w: 200, h: 200 });
  assert.equal(minimapScale(map, e), 200 / 16000);
});

test("a wide map keeps the width at size and shrinks the height", () => {
  const map = { width: 24000, height: 12000 };
  const e = minimapExtent(map, 200);
  assert.deepEqual(e, { w: 200, h: 100 });
  assert.equal(minimapScale(map, e), 200 / 24000);
});

test("a tall map keeps the height at size and shrinks the width", () => {
  const map = { width: 8000, height: 16000 };
  const e = minimapExtent(map, 200);
  assert.deepEqual(e, { w: 100, h: 200 });
  assert.equal(minimapScale(map, e), 100 / 8000);
});

test("clicks map back per axis", () => {
  const map = { width: 24000, height: 12000 };
  assert.deepEqual(minimapWorld(map, 0.5, 0.5), { x: 12000, y: 6000 });
  assert.deepEqual(minimapWorld(map, 1, 0), { x: 24000, y: 0 });
});

test("a click at a canvas pixel lands on the same world point the scale draws it at", () => {
  const map = { width: 24000, height: 12000 };
  const e = minimapExtent(map, 200);
  const k = minimapScale(map, e);
  const p = minimapWorld(map, 150 / e.w, 40 / e.h);
  assert.ok(Math.abs(p.x * k - 150) < 1e-9);
  assert.ok(Math.abs(p.y * k - 40) < 1e-9);
});
