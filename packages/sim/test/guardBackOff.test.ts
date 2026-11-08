import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnUnit, step, UNIT_STATS, type SimState, type Unit } from "../src/index.ts";
import { holdBand } from "../src/holdBand.ts";
import { GUARD_LEASH, GUARD_MARGIN } from "../src/stats.ts";
import { freshState, TINY } from "./helpers.ts";

/** Flat open ground. */
function map(): SimState {
  return freshState(1, TINY, (spec) => {
    spec.heights.fill(500);
    spec.features = [];
    spec.fields = [];
  });
}

const NEAR = holdBand(UNIT_STATS.artillery.range, UNIT_STATS.artillery.minRange).near;

/** An idle tank at (1000, 1000); a `kind` at (1200, 1000) guards it; an unarmed enemy 150 south of the guard. */
function setup(kind: "artillery" | "tank", sieged = false): { s: SimState; u: Unit; charge: Unit; foe: Unit } {
  const s = map();
  const charge = spawnUnit(s.world, 0, "tank", 1000, 1000);
  const u = spawnUnit(s.world, 0, kind, 1200, 1000);
  if (sieged) u.mode = "sieged";
  u.orders = [{ type: "guard", target: charge.id, chase: false }];
  const foe = spawnUnit(s.world, 1, "harvester", 1200, 1150);
  return { s, u, charge, foe };
}

const gap = (u: Unit, t: Unit) => Math.hypot(u.x - t.x, u.y - t.y);

test("guarding artillery backs off an enemy inside minRange, then fires on it", () => {
  const { s, u, charge, foe } = setup("artillery");
  let fired = false;
  for (let t = 0; t < 200 && foe.hp > 0; t++) {
    step(s, []);
    if (u.lastFired === 0 && u.target === foe.id) fired = true;
  }
  assert.ok(fired, "artillery never fired on the foe");
  assert.ok(gap(u, foe) >= NEAR - 1 || foe.hp <= 0, `gap ${gap(u, foe)}`);
  assert.ok(u.y < 1000, `artillery y ${u.y}`);
  assert.ok(gap(u, charge) <= GUARD_LEASH + GUARD_MARGIN + 85, `leash gap ${gap(u, charge)}`);
  assert.equal(u.orders[0]?.type, "guard");
});

test("a guarding tank (minRange 0) stands as before", () => {
  const { s, u } = setup("tank");
  for (let t = 0; t < 60; t++) step(s, []);
  assert.equal(u.x, 1200);
  assert.equal(u.y, 1000);
});

test("a guard backing off settles without oscillation", () => {
  const { s, u, charge } = setup("artillery");
  for (let t = 0; t < 200; t++) step(s, []);
  for (let t = 0; t < 100; t++) {
    const x = u.x, y = u.y;
    step(s, []);
    assert.ok(Math.hypot(u.x - x, u.y - y) < 1, `tick ${t} moved`);
    assert.ok(gap(u, charge) <= GUARD_LEASH + GUARD_MARGIN + 85, `leash gap ${gap(u, charge)}`);
  }
});

test("a sieged guard with an enemy inside minRange does not move", () => {
  const { s, u } = setup("artillery", true);
  for (let t = 0; t < 60; t++) step(s, []);
  assert.equal(u.mode, "sieged");
  assert.equal(u.x, 1200);
  assert.equal(u.y, 1000);
});
