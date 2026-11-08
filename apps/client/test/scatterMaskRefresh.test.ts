import assert from "node:assert/strict";
import { test } from "node:test";
import type { Feature, ResourceField, Terrain, VertexBox } from "@mf/sim";
import { refreshScatterMask, scatterMask } from "../src/render/scatterMask.ts";
import { heightPixelRect, paintHeights } from "../src/ui/heightImage.ts";

const N = 33;
const CELL = 50;

function bumpy(): Terrain {
  const heights = new Array<number>(N * N).fill(0);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) heights[j * N + i] = 80 * Math.sin(i * 0.4) * Math.cos(j * 0.3) + 90;
  return { cols: N, rows: N, cell: CELL, heights, seaLevel: 0 };
}

function world(terrain: Terrain) {
  const features = [{ x: 400, y: 400, radius: 30 }, { x: 800, y: 300, radius: 20 }] as unknown as Feature[];
  const fields = [{ x: 600, y: 700, radius: 90 }] as unknown as ResourceField[];
  return { terrain, features, fields };
}

/** Flattens a crater in place, as a blast does. */
function dig(t: Terrain, box: VertexBox): void {
  for (let j = box.j0; j <= box.j1; j++) for (let i = box.i0; i <= box.i1; i++) t.heights[j * N + i] = 10;
}

test("box refresh of the scatter mask equals a full rebuild", () => {
  const t = bumpy();
  const w = world(t);
  const mask = scatterMask(w);
  const box = { i0: 6, j0: 7, i1: 12, j1: 11 };
  dig(t, box);
  refreshScatterMask(mask, w, box);
  assert.deepEqual(mask, scatterMask(w));
});

test("box refresh keeps feature and field marks inside the box", () => {
  const t = bumpy();
  const w = world(t);
  const mask = scatterMask(w);
  const box = { i0: 5, j0: 5, i1: 13, j1: 13 }; // covers the feature at (400, 400)
  dig(t, box);
  refreshScatterMask(mask, w, box);
  assert.equal(mask[8 * (N - 1) + 8], 1);
});

test("box refresh at the map edge stays in range", () => {
  const t = bumpy();
  const w = world(t);
  const mask = scatterMask(w);
  const box = { i0: 0, j0: N - 3, i1: 2, j1: N - 1 };
  dig(t, box);
  refreshScatterMask(mask, w, box);
  assert.deepEqual(mask, scatterMask(w));
});

test("repainting the height pixels in a box equals a full repaint", () => {
  const t = bumpy();
  const w = 64, h = 64;
  const before = new Uint8ClampedArray(w * h * 4);
  paintHeights(before, t, w, h, { x0: 0, y0: 0, x1: w - 1, y1: h - 1 });
  const box = { i0: 10, j0: 4, i1: 15, j1: 9 };
  dig(t, box);
  const rect = heightPixelRect(t, w, h, box)!;
  const part = new Uint8ClampedArray((rect.x1 - rect.x0 + 1) * (rect.y1 - rect.y0 + 1) * 4);
  paintHeights(part, t, w, h, rect);
  const after = new Uint8ClampedArray(w * h * 4);
  paintHeights(after, t, w, h, { x0: 0, y0: 0, x1: w - 1, y1: h - 1 });
  const merged = before.slice();
  const rw = rect.x1 - rect.x0 + 1;
  for (let y = rect.y0; y <= rect.y1; y++) {
    for (let x = rect.x0; x <= rect.x1; x++) {
      for (let c = 0; c < 4; c++) merged[(y * w + x) * 4 + c] = part[((y - rect.y0) * rw + (x - rect.x0)) * 4 + c]!;
    }
  }
  assert.deepEqual(merged, after);
});
