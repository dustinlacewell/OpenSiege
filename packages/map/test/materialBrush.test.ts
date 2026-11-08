import assert from "node:assert/strict";
import { test } from "node:test";
import { applyMaterialChanges, dirtyBounds, paintMaterial } from "../src/materialBrush.ts";
import type { MaterialChange } from "../src/materialBrush.ts";
import type { MaterialLayer } from "../src/types.ts";

const grid = { cols: 11, rows: 11, cell: 10 };

function makeLayer(): MaterialLayer {
  const weights = new Uint8Array(grid.cols * grid.rows * 4);
  for (let v = 0; v < grid.cols * grid.rows; v++) {
    weights[v * 4] = 255;
  }
  return { weights };
}

const sumAt = (l: MaterialLayer, v: number): number =>
  l.weights[v * 4]! + l.weights[v * 4 + 1]! + l.weights[v * 4 + 2]! + l.weights[v * 4 + 3]!;

const brush = { x: 50, y: 50, radius: 30, strength: 0.5, falloff: 0.5 };

test("sum stays 255 on touched vertices", () => {
  const layer = makeLayer();
  for (let n = 0; n < 5; n++) {
    applyMaterialChanges(layer, paintMaterial(grid, layer, 2, brush), "after");
    applyMaterialChanges(layer, paintMaterial(grid, layer, 1, { ...brush, x: 40 }), "after");
  }
  for (let v = 0; v < grid.cols * grid.rows; v++) assert.equal(sumAt(layer, v), 255);
});

test("repeated dabs converge to 255 on the channel", () => {
  const layer = makeLayer();
  for (let n = 0; n < 40; n++) applyMaterialChanges(layer, paintMaterial(grid, layer, 3, brush), "after");
  const center = 5 * grid.cols + 5;
  assert.equal(layer.weights[center * 4 + 3], 255);
  assert.equal(layer.weights[center * 4], 0);
});

test("centre changes more than rim", () => {
  const layer = makeLayer();
  const changes = paintMaterial(grid, layer, 1, brush);
  const gain = (v: number): number => {
    const c = changes.find((x) => x.index === v)!;
    return c.after[1] - c.before[1];
  };
  assert.ok(gain(5 * grid.cols + 5) > gain(5 * grid.cols + 7));
});

test("outside radius untouched", () => {
  const layer = makeLayer();
  const changes = paintMaterial(grid, layer, 1, brush);
  for (const c of changes) {
    const i = c.index % grid.cols;
    const j = Math.floor(c.index / grid.cols);
    assert.ok(Math.hypot(i * 10 - 50, j * 10 - 50) < brush.radius);
  }
  assert.ok(!changes.some((c) => c.index === 0));
});

test("paintMaterial does not mutate the layer", () => {
  const layer = makeLayer();
  const copy = layer.weights.slice();
  paintMaterial(grid, layer, 1, brush);
  assert.deepEqual(layer.weights, copy);
});

test("undo restores exact bytes", () => {
  const layer = makeLayer();
  const start = layer.weights.slice();
  const all: MaterialChange[][] = [];
  for (let n = 0; n < 4; n++) {
    const c = paintMaterial(grid, layer, (n % 4) as 0 | 1 | 2 | 3, brush);
    applyMaterialChanges(layer, c, "after");
    all.push(c);
  }
  for (const c of all.reverse()) applyMaterialChanges(layer, c, "before");
  assert.deepEqual(layer.weights, start);
});

test("edge and off-map brushes are safe", () => {
  const layer = makeLayer();
  const corner = paintMaterial(grid, layer, 1, { ...brush, x: 0, y: 0 });
  assert.ok(corner.length > 0);
  assert.ok(corner.every((c) => c.index >= 0 && c.index < grid.cols * grid.rows));
  assert.deepEqual(paintMaterial(grid, layer, 1, { ...brush, x: -500, y: -500 }), []);
  const far = paintMaterial(grid, layer, 1, { ...brush, x: 100, y: 100 });
  assert.ok(far.some((c) => c.index === grid.cols * grid.rows - 1));
});

test("no change when the channel is already 255", () => {
  const layer = makeLayer();
  assert.deepEqual(paintMaterial(grid, layer, 0, brush), []);
});

test("dirtyBounds", () => {
  assert.equal(dirtyBounds([], grid.cols), null);
  const z: [number, number, number, number] = [0, 0, 0, 0];
  const ch = (i: number, j: number): MaterialChange => ({ index: j * grid.cols + i, before: z, after: z });
  assert.deepEqual(dirtyBounds([ch(3, 4), ch(7, 2), ch(5, 9)], grid.cols), { i0: 3, j0: 2, i1: 7, j1: 9 });
});
