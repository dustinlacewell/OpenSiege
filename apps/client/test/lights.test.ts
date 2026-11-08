import { test } from "node:test";
import assert from "node:assert/strict";
import { FLOATS_PER_LIGHT, LIGHT_BUFFER_FLOATS, LightPool, MAX_LIGHTS } from "../src/game/lights.ts";

const ALL = { sees: () => true };
const out = () => new Float32Array(16 * FLOATS_PER_LIGHT);

/** Red channel of the first packed light, or 0 when none packed. */
function red(pool: LightPool): number {
  const o = out();
  return pool.pack(o, ALL) > 0 ? o[8]! : 0;
}

test("a decay light starts at full, falls fast, and dies at its life", () => {
  const pool = new LightPool();
  pool.spawn(0, 0, 0, 10, [4, 2, 1], 1, "decay");
  assert.equal(red(pool), 4);
  pool.advance(0.5);
  assert.ok(Math.abs(red(pool) - 4 * 0.125) < 1e-6);
  pool.advance(0.5);
  assert.equal(pool.pack(out(), ALL), 0);
});

test("a hold light stays full for its hold part, then ramps to 0", () => {
  const pool = new LightPool();
  pool.spawn(0, 0, 0, 10, [2, 2, 2], 1, "hold", 0.5);
  pool.advance(0.4);
  assert.equal(red(pool), 2);
  pool.advance(0.35);
  assert.ok(Math.abs(red(pool) - 1) < 1e-6);
  pool.advance(0.3);
  assert.equal(pool.pack(out(), ALL), 0);
});

test("held lights last until the next beginFrame", () => {
  const pool = new LightPool();
  pool.hold(0, 0, 0, 10, 0, 0, 5, [1, 1, 1]);
  pool.advance(5);
  assert.equal(pool.pack(out(), ALL), 1);
  pool.beginFrame();
  assert.equal(pool.pack(out(), ALL), 0);
});

test("pack keeps the strongest lights and drops the weakest", () => {
  const pool = new LightPool();
  for (let i = 1; i <= 5; i++) pool.spawn(i, 0, 0, 10, [i, 0, 0], 1, "hold");
  const o = out();
  assert.equal(pool.pack(o, ALL, 3), 3);
  const packed = [0, 1, 2].map((k) => o[k * FLOATS_PER_LIGHT]!);
  assert.deepEqual(packed, [5, 4, 3]);
});

test("pack writes lights strongest first", () => {
  const pool = new LightPool();
  for (const s of [2, 7, 1, 5, 3]) pool.spawn(s, 0, 0, 10, [s, 0, 0], 1, "hold");
  const o = out();
  assert.equal(pool.pack(o, ALL), 5);
  assert.deepEqual([0, 1, 2, 3, 4].map((k) => o[k * FLOATS_PER_LIGHT]!), [7, 5, 3, 2, 1]);
});

test("pack stops at MAX_LIGHTS by default", () => {
  const pool = new LightPool();
  for (let i = 0; i < MAX_LIGHTS + 10; i++) pool.hold(i, 0, 0, i, 0, 0, 5, [1, 1, 1]);
  assert.equal(pool.pack(new Float32Array(LIGHT_BUFFER_FLOATS), ALL), MAX_LIGHTS);
});

test("pack skips lights whose midpoint is not seen", () => {
  const pool = new LightPool();
  pool.spawn(100, 0, 0, 10, [1, 1, 1], 1, "hold");
  pool.hold(-10, 0, 0, 30, 0, 0, 10, [1, 1, 1]);
  const o = out();
  assert.equal(pool.pack(o, { sees: (x) => x < 50 }), 1);
  assert.equal(o[0], -10);
});

test("pack writes [A, radius], [B, 0], [rgb times fade, 0]", () => {
  const pool = new LightPool();
  pool.hold(1, 2, 3, 4, 5, 6, 7, [0.5, 1, 2]);
  pool.spawn(9, 9, 9, 1, [0.1, 0.1, 0.1], 1, "hold", 0);
  pool.advance(0.5);
  const o = out();
  assert.equal(pool.pack(o, ALL), 2);
  assert.deepEqual([...o.subarray(0, 12)], [1, 2, 3, 7, 4, 5, 6, 0, 0.5, 1, 2, 0]);
  assert.deepEqual([...o.subarray(12, 24)].map((v) => Math.round(v * 1000) / 1000), [9, 9, 9, 1, 9, 9, 9, 0, 0.05, 0.05, 0.05, 0]);
});
