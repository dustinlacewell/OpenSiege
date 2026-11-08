import { test } from "node:test";
import assert from "node:assert/strict";
import { buildGrid, detect, mapSize, spawnUnit, UNIT_STATS, type SimState, type Unit } from "../src/index.ts";
import { freshState, seat, WIDE } from "./helpers.ts";

// Players 0 and 1 are allies on team 5. Player 2 is on team 6. Units stand on y = 4000, far from the seat factories.

const Y = 4000;

/** WIDE flattened to 0, with the three players seated. */
function flat(): SimState {
  const s = freshState(1, WIDE, (spec) => {
    spec.heights.fill(0);
    spec.features = [];
    spec.fields = [];
  });
  seat(s, 0, 5);
  seat(s, 1, 5);
  seat(s, 2, 6);
  return s;
}

/** Raise the vertex column at world x to `h`: a north-south ridge. */
function ridge(s: SimState, x: number, h: number): void {
  const t = s.world.terrain;
  const ix = x / t.cell;
  for (let iy = 0; iy < t.rows; iy++) t.heights[iy * t.cols + ix] = h;
}

function levelFor(s: SimState, viewer: number, u: Unit) {
  return detect(s.world, buildGrid(s.world.units, mapSize(s.world.terrain))).level(viewer, u);
}

test("an enemy in sight on flat ground is seen", () => {
  const s = flat();
  spawnUnit(s.world, 0, "tank", 10000, Y);
  const e = spawnUnit(s.world, 2, "tank", 10000 + UNIT_STATS.tank.sight - 100, Y);
  assert.equal(levelFor(s, 0, e), "seen");
});

test("the same enemy behind a hill but in radar range is a radar contact", () => {
  const s = flat();
  ridge(s, 10375, 900);
  spawnUnit(s.world, 0, "tank", 10000, Y);
  const e = spawnUnit(s.world, 2, "tank", 10000 + UNIT_STATS.tank.sight - 100, Y);
  assert.ok(UNIT_STATS.tank.sight - 100 < UNIT_STATS.tank.radar);
  assert.equal(levelFor(s, 0, e), "radar");
});

test("an enemy out of sight and radar range is not detected", () => {
  const s = flat();
  spawnUnit(s.world, 0, "tank", 10000, Y);
  const e = spawnUnit(s.world, 2, "tank", 10000 + UNIT_STATS.tank.radar + 100, Y);
  const d = detect(s.world, buildGrid(s.world.units, mapSize(s.world.terrain)));
  assert.equal(d.level(0, e), "none");
  assert.equal(d.detects(0, e), false);
});

test("an ally's unit gives its teammate sight; own and allied units are seen", () => {
  const s = flat();
  const a = spawnUnit(s.world, 1, "tank", 10000, Y);
  const e = spawnUnit(s.world, 2, "tank", 10000 + UNIT_STATS.tank.sight - 100, Y);
  const d = detect(s.world, buildGrid(s.world.units, mapSize(s.world.terrain)));
  assert.equal(d.level(0, e), "seen");
  assert.equal(d.level(0, a), "seen");
  assert.equal(d.level(2, a), "seen");
});

test("a sieged radar truck senses out to its siege radar", () => {
  const s = flat();
  const r = spawnUnit(s.world, 0, "radar", 10000, Y);
  const gap = Math.floor((UNIT_STATS.radar.radar + UNIT_STATS.radar.siegeRadar) / 2);
  const e = spawnUnit(s.world, 2, "tank", 10000 + gap, Y);
  assert.equal(levelFor(s, 0, e), "none");
  r.mode = "sieged";
  assert.equal(levelFor(s, 0, e), "radar");
});

test("the answer does not depend on which team asks first", () => {
  const s = flat();
  const mine = spawnUnit(s.world, 0, "tank", 10000, Y);
  const e = spawnUnit(s.world, 2, "tank", 10000 + UNIT_STATS.tank.sight - 100, Y);
  const d = detect(s.world, buildGrid(s.world.units, mapSize(s.world.terrain)));
  assert.equal(d.level(2, mine), "seen");
  assert.equal(d.level(0, e), "seen");
  assert.equal(d.level(1, e), "seen");
});
