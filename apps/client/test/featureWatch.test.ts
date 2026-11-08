import assert from "node:assert/strict";
import { test } from "node:test";
import type { Feature, ResourceField, Terrain } from "@mf/sim";
import { FeatureWatch } from "../src/render/featureWatch.ts";

const TERRAIN = { cols: 2, rows: 2, cell: 50, heights: [0, 0, 0, 0], seaLevel: 0 } as Terrain;

function feature(id: number, kind: Feature["kind"] = "rock"): Feature {
  return { id, kind, x: id * 10, y: 0, radius: 20, hp: 0, variant: 0 };
}

function world(features: Feature[]) {
  return { terrain: TERRAIN, features, fields: [] as ResourceField[] };
}

/** A watch that has seen `features` once. */
function seen(features: Feature[]): FeatureWatch {
  const w = new FeatureWatch();
  assert.equal(w.changed(world(features)), true);
  assert.equal(w.changed(world(features)), false);
  return w;
}

test("a new feature at the end is a change", () => {
  const fs = [feature(1), feature(2)];
  const w = seen(fs);
  fs.push(feature(9, "scrap"));
  assert.equal(w.changed(world(fs)), true);
  assert.equal(w.changed(world(fs)), false);
});

test("a removed feature is a change", () => {
  const fs = [feature(1), feature(2), feature(3)];
  const w = seen(fs);
  fs.splice(1, 1);
  assert.equal(w.changed(world(fs)), true);
});

test("scrap turning to wreckage is a change, though the count is the same", () => {
  const fs = [feature(1), feature(5, "scrap"), feature(6)];
  const w = seen(fs);
  fs.splice(1, 1);
  fs.push(feature(7, "wreckage"));
  assert.equal(fs.length, 3);
  assert.equal(w.changed(world(fs)), true);
});

test("the last feature swapped is a change", () => {
  const fs = [feature(1), feature(5, "scrap")];
  const w = seen(fs);
  fs.splice(1, 1, feature(6, "wreckage"));
  assert.equal(w.changed(world(fs)), true);
});
