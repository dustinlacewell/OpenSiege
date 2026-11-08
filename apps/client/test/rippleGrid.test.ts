import { test } from "node:test";
import assert from "node:assert/strict";
import { RIPPLE_MAX_SIDE, RIPPLE_TEXEL, rippleGrid } from "../src/render/rippleGrid.ts";

test("the default 16000 map gets one texel per 16 world units", () => {
  assert.deepEqual(rippleGrid(16000, 16000), { cols: 1000, rows: 1000, texelX: 16, texelY: 16 });
});

test("a big map caps the long side and keeps the texels square", () => {
  const g = rippleGrid(40000, 20000);
  assert.equal(g.cols, RIPPLE_MAX_SIDE);
  assert.equal(g.rows, RIPPLE_MAX_SIDE / 2);
  assert.ok(Math.abs(g.texelX - g.texelY) < 1e-9);
});

test("the GPU's texture limit caps it further", () => {
  const g = rippleGrid(16000, 8000, 512);
  assert.equal(g.cols, 512);
  assert.equal(g.rows, 256);
});

test("a small map rounds up to whole texels, never fewer than one", () => {
  assert.deepEqual(rippleGrid(8, 8), { cols: 1, rows: 1, texelX: 8, texelY: 8 });
  const g = rippleGrid(1000, 500);
  assert.equal(g.cols, Math.ceil(1000 / RIPPLE_TEXEL));
  assert.equal(g.rows, Math.ceil(500 / RIPPLE_TEXEL));
});
