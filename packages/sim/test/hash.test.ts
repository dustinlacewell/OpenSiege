import { test } from "node:test";
import assert from "node:assert/strict";
import { createWorld, decodeWorld, encodeWorld, hashWorld } from "../src/index.ts";
import { TALL, cachedSpec } from "./helpers.ts";

const world = () => createWorld(structuredClone(cachedSpec(1, TALL)));

test("equal worlds hash equal", () => {
  assert.equal(hashWorld(world()), hashWorld(world()));
});

for (const [name, index] of [["index 1", 1], ["a middle index", 4321], ["the last index", 81 * 241 - 1]] as const) {
  test(`hash changes when height at ${name} changes`, () => {
    const a = world(), b = world();
    assert.ok(index % 97 !== 0);
    b.terrain.heights[index] = b.terrain.heights[index]! === 0 ? 1 : b.terrain.heights[index]! - 1;
    assert.notEqual(hashWorld(a), hashWorld(b));
  });
}

test("hash differs for same heights on a different cell size", () => {
  const a = world(), b = world();
  b.terrain.cell = 100;
  assert.notEqual(hashWorld(a), hashWorld(b));
});

test("encode and decode keep the hash on a rectangle world", () => {
  const w = world();
  const back = decodeWorld(encodeWorld(w));
  assert.equal(hashWorld(back), hashWorld(w));
  assert.deepEqual([back.terrain.cols, back.terrain.rows, back.terrain.cell], [81, 241, 50]);
});
