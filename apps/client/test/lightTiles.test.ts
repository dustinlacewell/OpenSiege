import { test } from "node:test";
import assert from "node:assert/strict";
import { FLOATS_PER_LIGHT } from "../src/game/lights.ts";
import { mat4, perspective } from "../src/game/mat4.ts";
import { LIGHT_INDEX_CAPACITY, LightTiles, MAX_PER_TILE } from "../src/render/lightTiles.ts";

/** Eye at the origin looking down -z, 90 degree view: the projection is the whole camera. */
const VIEW_PROJ = perspective(mat4(), Math.PI / 2, 1, 1, 10000);

function points(...xyzr: [number, number, number, number][]): Float32Array {
  const out = new Float32Array(xyzr.length * FLOATS_PER_LIGHT);
  xyzr.forEach(([x, y, z, r], i) => {
    out.set([x, y, z, r, x, y, z, 0, 1, 1, 1, 0], i * FLOATS_PER_LIGHT);
  });
  return out;
}

function repeat(n: number, light: [number, number, number, number]): Float32Array {
  return points(...Array.from({ length: n }, () => light));
}

/** Tiles that hold at least one light, as "x,y". */
function litTiles(t: LightTiles): string[] {
  const lit: string[] = [];
  for (let y = 0; y < t.tilesY; y++) {
    for (let x = 0; x < t.tilesX; x++) if (t.tiles[(y * t.tilesX + x) * 2 + 1]! > 0) lit.push(`${x},${y}`);
  }
  return lit;
}

/** Offsets run back to back from 0, each run is in light order, and the runs fill exactly `indexCount`. */
function assertConsistent(t: LightTiles): void {
  let offset = 0;
  for (let s = 0; s < t.tiles.length; s += 2) {
    assert.equal(t.tiles[s], offset);
    const count = t.tiles[s + 1]!;
    for (let k = 1; k < count; k++) assert.ok(t.indices[offset + k]! > t.indices[offset + k - 1]!);
    offset += count;
  }
  assert.equal(offset, t.indexCount);
}

test("a small light at the screen centre lands only in the tiles it overlaps", () => {
  const t = new LightTiles();
  t.bin(points([0, 0, -100, 5]), 1, VIEW_PROJ, 256, 256);
  assert.equal(t.tilesX, 8);
  assert.equal(t.tilesY, 8);
  assert.deepEqual(litTiles(t), ["3,3", "4,3", "3,4", "4,4"]);
  assertConsistent(t);
});

test("a light off to the top right lands in the top right tiles (y counts from the bottom)", () => {
  const t = new LightTiles();
  t.bin(points([90, 90, -100, 5]), 1, VIEW_PROJ, 256, 256);
  assert.deepEqual(litTiles(t), ["7,7"]);
});

test("a light behind the camera covers every tile", () => {
  const t = new LightTiles();
  t.bin(points([0, 0, 100, 5]), 1, VIEW_PROJ, 256, 256);
  assert.equal(litTiles(t).length, 64);
  assertConsistent(t);
});

test("a light fully off screen covers no tile", () => {
  const t = new LightTiles();
  t.bin(points([1000, 0, -100, 5]), 1, VIEW_PROJ, 256, 256);
  assert.deepEqual(litTiles(t), []);
  assert.equal(t.indexCount, 0);
});

test("a tile keeps only the first MAX_PER_TILE lights, the strongest", () => {
  const t = new LightTiles();
  t.bin(repeat(MAX_PER_TILE + 6, [0, 0, -100, 5]), MAX_PER_TILE + 6, VIEW_PROJ, 256, 256);
  const centre = (3 * t.tilesX + 3) * 2;
  assert.equal(t.tiles[centre + 1], MAX_PER_TILE);
  const run = [...t.indices.subarray(t.tiles[centre]!, t.tiles[centre]! + MAX_PER_TILE)];
  assert.deepEqual(run, Array.from({ length: MAX_PER_TILE }, (_, i) => i));
  assertConsistent(t);
});

test("past the index capacity, later tiles drop their lights and the list stays consistent", () => {
  const t = new LightTiles();
  t.bin(repeat(10, [0, 0, 100, 5]), 10, VIEW_PROJ, 2048, 2048);
  assert.equal(t.tilesX * t.tilesY * 10 > LIGHT_INDEX_CAPACITY, true);
  assert.equal(t.indexCount, LIGHT_INDEX_CAPACITY);
  assertConsistent(t);
  const last = t.tiles.length - 2;
  assert.equal(t.tiles[last + 1], 0);
  assert.equal(t.indices[t.tiles[0]!], 0);
});

test("binning again resets the previous frame", () => {
  const t = new LightTiles();
  t.bin(points([0, 0, 100, 5]), 1, VIEW_PROJ, 256, 256);
  t.bin(points([0, 0, -100, 5]), 1, VIEW_PROJ, 256, 256);
  assert.equal(litTiles(t).length, 4);
  assertConsistent(t);
});
