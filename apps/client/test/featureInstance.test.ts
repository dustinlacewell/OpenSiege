import assert from "node:assert/strict";
import { test } from "node:test";
import { FEATURE_STATS, UNIT_STATS, type Feature, type Terrain } from "@mf/sim";
import { featureInstance, WRECK_HEIGHT } from "../src/render/featureInstance.ts";
import { createPropInstance } from "../src/render/propInstance.ts";

const N = 9;
const FLAT: Terrain = { cols: N, rows: N, cell: 50, heights: new Array<number>(N * N).fill(20), seaLevel: 0 };

function feature(over: Partial<Feature>): Feature {
  return { id: 1, kind: "rock", x: 200, y: 200, radius: 30, hp: 0, variant: 0, ...over };
}

/** Height spread is ±10% from the position. */
function near(actual: number, base: number): boolean {
  return actual >= base * 0.9 - 1e-9 && actual <= base * 1.1 + 1e-9;
}

test("scrap is drawn as tall as its unit", () => {
  const out = createPropInstance();
  featureInstance(feature({ kind: "scrap", unit: "factory", radius: UNIT_STATS.factory.radius }), FLAT, out);
  assert.ok(near(out.scaleZ, UNIT_STATS.factory.height), `${out.scaleZ}`);
  assert.equal(out.scaleXY, UNIT_STATS.factory.radius);
});

test("wreckage is drawn as a fraction of its unit's height", () => {
  const out = createPropInstance();
  featureInstance(feature({ kind: "wreckage", unit: "tank", radius: UNIT_STATS.tank.radius }), FLAT, out);
  assert.ok(near(out.scaleZ, UNIT_STATS.tank.height * WRECK_HEIGHT.wreckage), `${out.scaleZ}`);
  assert.ok(out.scaleZ > 0);
});

test("map features keep their kind's height", () => {
  const out = createPropInstance();
  featureInstance(feature({ kind: "tree" }), FLAT, out);
  assert.ok(near(out.scaleZ, FEATURE_STATS.tree.height), `${out.scaleZ}`);
});
