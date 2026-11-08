import { test } from "node:test";
import assert from "node:assert/strict";
import { inWater, seaLevelOf, spawnUnit, step, UNIT_STATS, WATER_LEVEL } from "../src/index.ts";
import { PROJ_FP } from "../src/stats.ts";
import { stampCrater } from "../src/terrain/crater.ts";
import type { Terrain } from "../src/types.ts";
import { freshState, TINY } from "./helpers.ts";

const N = 9, CELL = 125;

function flat(height: number): Terrain {
  const heights = new Array<number>(N * N).fill(height);
  return { cols: N, rows: N, cell: CELL, heights, seaLevel: seaLevelOf(heights) };
}

test("sea level is the lowest vertex plus WATER_LEVEL", () => {
  assert.equal(seaLevelOf([300, 120, 900, 450]), 120 + WATER_LEVEL);
  assert.equal(seaLevelOf([0, 0]), WATER_LEVEL);
});

test("ground below the sea level is water; at the level it is not", () => {
  const t = flat(500);
  t.seaLevel = 501;
  assert.equal(inWater(t, 500, 500), true);
  t.seaLevel = 500;
  assert.equal(inWater(t, 500, 500), false);
  t.seaLevel = 499;
  assert.equal(inWater(t, 500, 500), false);
});

test("a crater does not change the sea level", () => {
  const t = flat(500);
  const before = t.seaLevel;
  const dug = new Array<number>(N * N).fill(0);
  const box = stampCrater(t, dug, { x: 4 * CELL * PROJ_FP, y: 4 * CELL * PROJ_FP, z: 500 * PROJ_FP, damage: 1000, radius: 300, dig: 10, owner: -1 });
  assert.ok(box);
  assert.ok(t.heights[4 * N + 4]! < 500);
  assert.equal(t.seaLevel, before);
});

const KIND = "tank";

/** Per-tick x steps of a tank driving east on flat open ground at height 500, with the sea at `seaLevel`. */
function drive(seaLevel: number): number[] {
  const s = freshState(1, TINY, (spec) => {
    spec.heights.fill(500);
    spec.features = [];
    spec.fields = [];
  });
  s.world.terrain.seaLevel = seaLevel;
  const u = spawnUnit(s.world, 0, KIND, 200, 1000);
  step(s, [{ player: 0, intent: { t: "move", units: [u.id], x: 1900, y: 1000, force: false, queue: false, attack: false } }]);
  const steps: number[] = [];
  for (let t = 0; t < 5; t++) {
    const x = u.x;
    step(s, []);
    steps.push(u.x - x);
  }
  return steps;
}

test("a unit in water drives at waterSpeed percent of its dry speed", () => {
  const s = UNIT_STATS[KIND];
  const dry = drive(0);
  const wet = drive(1000);
  assert.deepEqual(dry, new Array(5).fill(s.speed));
  assert.deepEqual(wet, new Array(5).fill(Math.floor((s.speed * s.waterSpeed) / 100)));
});
