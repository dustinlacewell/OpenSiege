import { test } from "node:test";
import assert from "node:assert/strict";
import { MAX_FIELDS, validateMapSpec, type MapSpec } from "@mf/sim";
import { eraseFeatures, moveField, placeField, placeFeature, removeField, resizeField, scatterFeatures, type Feature, type Field } from "../src/placement.ts";

const map = { width: 8000, height: 8000 };

function specWith(features: Feature[], fields: Field[]): MapSpec {
  const cell = 125, n = map.width / cell + 1;
  return { ...map, cell, heights: new Array(n * n).fill(0), rng: 1, fields, features };
}

test("placeFeature: default radius, clamp, variant, no mutation", () => {
  const before: Feature[] = [];
  const out = placeFeature(before, "rock", -50, 9000, undefined, map);
  assert.equal(before.length, 0);
  assert.deepEqual(out, [{ kind: "rock", x: 0, y: 8000, radius: 145, variant: 0 }]);
  const o2 = placeFeature(out, "tree", 100.4, 200.6, { radius: 60, variant: 2 }, map);
  assert.equal(o2.length, 2);
  assert.deepEqual(o2[1], { kind: "tree", x: 100, y: 201, radius: 60, variant: 2 });
});

test("scatterFeatures: deterministic, bounded, no overlap, in map", () => {
  const existing: Feature[] = [{ kind: "rock", x: 4000, y: 4000, radius: 150, variant: 0 }];
  const copy = structuredClone(existing);
  const brush = { x: 4000, y: 4000, radius: 1500 };
  const a = scatterFeatures(existing, "tree", brush, 40, 7, map);
  const b = scatterFeatures(existing, "tree", brush, 40, 7, map);
  assert.deepEqual(a, b);
  assert.deepEqual(existing, copy);
  assert.notDeepEqual(a, scatterFeatures(existing, "tree", brush, 40, 8, map));
  const max = Math.floor((40 * Math.PI * 1500 * 1500) / 1e6);
  assert.ok(a.length > 1 && a.length - 1 <= max);
  for (let i = 0; i < a.length; i++) {
    for (let j = 0; j < i; j++) {
      const d = Math.hypot(a[i]!.x - a[j]!.x, a[i]!.y - a[j]!.y);
      assert.ok(d >= (a[i]!.radius + a[j]!.radius) * 0.75 - 1e-9);
    }
  }
  for (const f of a.slice(1)) {
    assert.ok(Math.hypot(f.x - brush.x, f.y - brush.y) <= brush.radius + 1);
    assert.ok(f.radius >= 50 && f.radius <= 80);
  }
  assert.deepEqual(validateMapSpec(specWith(a, [])), []);
});

test("scatterFeatures: drops points off the map", () => {
  const out = scatterFeatures([], "boulder", { x: 0, y: 0, radius: 1000 }, 200, 3, map);
  assert.ok(out.length > 0);
  assert.ok(out.every((f) => f.x >= 0 && f.y >= 0));
});

test("eraseFeatures: by disc and by kind", () => {
  const fs: Feature[] = [
    { kind: "rock", x: 100, y: 100, radius: 100, variant: 0 },
    { kind: "tree", x: 110, y: 100, radius: 60, variant: 0 },
    { kind: "tree", x: 5000, y: 5000, radius: 60, variant: 0 },
  ];
  const trees = eraseFeatures(fs, { x: 100, y: 100, radius: 50 }, "tree");
  assert.equal(trees.removed.length, 1);
  assert.equal(trees.features.length, 2);
  const all = eraseFeatures(fs, { x: 100, y: 100, radius: 50 });
  assert.equal(all.removed.length, 2);
  assert.equal(fs.length, 3);
});

test("fields: place, cap, edge, move, resize, remove", () => {
  const none: Field[] = [];
  const one = placeField(none, 1000, 1000, 400, undefined, map);
  assert.ok(Array.isArray(one));
  assert.deepEqual(one, [{ x: 1000, y: 1000, radius: 400, amount: 5000 }]);
  assert.equal(none.length, 0);
  assert.ok("error" in (placeField(none, 100, 1000, 400, 1, map) as object));
  assert.ok("error" in (placeField(none, 7700, 1000, 400, 1, map) as object));
  assert.ok("error" in (placeField(none, 1000, 1000, 0, 1, map) as object));
  const full: Field[] = Array.from({ length: MAX_FIELDS }, () => ({ x: 1000, y: 1000, radius: 100, amount: 1 }));
  assert.ok("error" in (placeField(full, 2000, 2000, 100, 1, map) as object));

  const f = one as Field[];
  const moved = moveField(f, 0, 2000, 3000, map) as Field[];
  assert.equal(moved[0]!.x, 2000);
  assert.equal(f[0]!.x, 1000);
  assert.ok("error" in (moveField(f, 0, 100, 3000, map) as object));
  assert.ok("error" in (moveField(f, 5, 2000, 3000, map) as object));
  const big = resizeField(f, 0, 900, map) as Field[];
  assert.equal(big[0]!.radius, 900);
  assert.ok("error" in (resizeField(f, 0, 1500, map) as object));
  assert.deepEqual(removeField(f, 0), []);
  assert.equal(f.length, 1);
  assert.deepEqual(validateMapSpec(specWith([], big)), []);
});
