import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnUnit, step, UNIT_STATS, type SimState, type Unit } from "../src/index.ts";
import { holdBand } from "../src/holdBand.ts";
import { holdRange } from "../src/targeting.ts";
import { freshState, TINY } from "./helpers.ts";

/** Flat open ground. */
function map(): SimState {
  return freshState(1, TINY, (spec) => {
    spec.heights.fill(500);
    spec.features = [];
    spec.fields = [];
  });
}

const NEAR = UNIT_STATS.artillery.minRange + Math.floor(UNIT_STATS.artillery.minRange / 8);
const FAR = holdRange(UNIT_STATS.artillery.range);

/** A `kind` at (1000, 1000) ordered to attack an unarmed enemy 150 east of it. */
function setup(kind: "artillery" | "tank", sieged = false): { s: SimState; u: Unit; foe: Unit } {
  const s = map();
  const u = spawnUnit(s.world, 0, kind, 1000, 1000);
  if (sieged) u.mode = "sieged";
  const foe = spawnUnit(s.world, 1, "harvester", 1150, 1000);
  step(s, [{ player: 0, intent: { t: "attack", units: [u.id], target: foe.id, queue: false } }]);
  return { s, u, foe };
}

const gap = (u: Unit, t: Unit) => Math.hypot(u.x - t.x, u.y - t.y);

test("holdBand: near is minRange plus an eighth, far is holdRange, near capped at far", () => {
  assert.deepEqual(holdBand(600, 300), { near: 337, far: 525 });
  assert.deepEqual(holdBand(600, 0), { near: 0, far: 525 });
  assert.deepEqual(holdBand(300, 300), { near: 263, far: 263 });
});

test("mobile artillery backs off a target inside minRange, then fires", () => {
  const { s, u, foe } = setup("artillery");
  for (let t = 0; t < 200; t++) step(s, []);
  const d = gap(u, foe);
  assert.ok(d >= NEAR - 1 && d <= FAR, `gap ${d}`);
  assert.ok(u.x < 1000 - (NEAR - 150) / 2, `artillery x ${u.x}`);
  assert.ok(foe.hp < UNIT_STATS.harvester.maxHp, `foe hp ${foe.hp}`);
  assert.equal(u.orders[0]?.type, "attack");
});

test("a tank (minRange 0) does not back off", () => {
  const { s, u } = setup("tank");
  for (let t = 0; t < 60; t++) step(s, []);
  assert.equal(u.x, 1000);
  assert.equal(u.y, 1000);
});

test("backing off settles without oscillation", () => {
  const { s, u } = setup("artillery");
  for (let t = 0; t < 250; t++) step(s, []);
  for (let t = 0; t < 50; t++) {
    const x = u.x, y = u.y;
    step(s, []);
    assert.ok(Math.hypot(u.x - x, u.y - y) < 1, `tick ${t} moved`);
  }
});

test("sieged artillery with a target inside minRange does not move", () => {
  const { s, u } = setup("artillery", true);
  for (let t = 0; t < 60; t++) step(s, []);
  assert.equal(u.mode, "sieged");
  assert.equal(u.x, 1000);
  assert.equal(u.y, 1000);
});
