import { test } from "node:test";
import assert from "node:assert/strict";
import { buildGrid, detect, jamRange, mapSize, spawnUnit, step, UNIT_STATS, type SimState, type Unit } from "../src/index.ts";
import { freshState, seat, WIDE } from "./helpers.ts";

// Players 0 and 1 are allies on team 5. Player 2 is on team 6. Units stand on y = 4000, far from the seat factories.
// A jammer stops enemy radar from detecting its own team's units near it. Sight still sees them.

const Y = 4000;
const X = 10000;
const J = UNIT_STATS.jammer;

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

function levelFor(s: SimState, viewer: number, u: Unit) {
  return detect(s.world, buildGrid(s.world.units, mapSize(s.world.terrain))).level(viewer, u);
}

/** Player 0's radar truck at X and player 2's tank 1500 away: beyond its sight, inside its radar. */
function radarContact() {
  const s = flat();
  spawnUnit(s.world, 0, "radar", X, Y);
  const e = spawnUnit(s.world, 2, "tank", X + 1500, Y);
  assert.ok(1500 > UNIT_STATS.radar.sight && 1500 < UNIT_STATS.radar.radar);
  return { s, e };
}

test("an enemy inside a jammer's jam radius is not a radar contact; without the jammer it is", () => {
  const { s, e } = radarContact();
  assert.equal(levelFor(s, 0, e), "radar");
  spawnUnit(s.world, 2, "jammer", X + 1800, Y);
  assert.ok(300 < J.jam);
  assert.equal(levelFor(s, 0, e), "none");
});

test("a jammed enemy within sight and a clear line is still seen", () => {
  const s = flat();
  spawnUnit(s.world, 0, "tank", X, Y);
  const e = spawnUnit(s.world, 2, "tank", X + UNIT_STATS.tank.sight - 100, Y);
  spawnUnit(s.world, 2, "jammer", X + UNIT_STATS.tank.sight + 100, Y);
  assert.equal(levelFor(s, 0, e), "seen");
});

test("the jammer itself is not a radar contact", () => {
  const s = flat();
  spawnUnit(s.world, 0, "radar", X, Y);
  const j = spawnUnit(s.world, 2, "jammer", X + 1500, Y);
  assert.ok(jamRange(j) > 0);
  assert.equal(levelFor(s, 0, j), "none");
});

test("a sieged jammer jams out to its siege jam radius", () => {
  const s = flat();
  assert.ok(J.jam < J.siegeJam);
  const gap = Math.floor((J.jam + J.siegeJam) / 2);
  const reach = UNIT_STATS.radar.radar - 100;
  assert.ok(reach > UNIT_STATS.radar.sight);
  spawnUnit(s.world, 0, "radar", X, Y);
  const e = spawnUnit(s.world, 2, "tank", X + reach, Y);
  const j = spawnUnit(s.world, 2, "jammer", X + reach - gap, Y);
  assert.equal(levelFor(s, 0, e), "radar");
  j.mode = "sieged";
  assert.equal(levelFor(s, 0, e), "none");
});

test("a jammer does not hide its enemies from its own team's radar", () => {
  const s = flat();
  spawnUnit(s.world, 2, "jammer", X, Y);
  const d = Math.floor((J.sight + Math.min(J.jam, J.radar)) / 2);
  const e = spawnUnit(s.world, 0, "tank", X + d, Y);
  assert.ok(d > J.sight && d < J.jam && d < J.radar);
  assert.equal(levelFor(s, 2, e), "radar");
});

test("sieged artillery does not fire at a jammed target that only its radar truck would detect", () => {
  const s = freshState(1, WIDE, (spec) => {
    spec.heights.fill(500);
    spec.features = [];
    spec.fields = [];
  });
  const gunX = 2000;
  const gun = spawnUnit(s.world, 0, "artillery", gunX, Y);
  gun.mode = "sieged";
  // Beyond the gun's own sight and radar, inside its siege range, so only the radar truck near the foe detects it.
  const A = UNIT_STATS.artillery;
  const foeDist = Math.max(A.sight, A.siegeRadar) + 100;
  assert.ok(foeDist <= A.siegeRange);
  const foe = spawnUnit(s.world, 1, "tank", gunX + foeDist, Y);
  const R = UNIT_STATS.radar;
  assert.ok(R.sight + 200 < R.radar);
  spawnUnit(s.world, 0, "radar", foe.x - R.sight - 200, Y);
  assert.equal(levelFor(s, 0, foe), "radar");
  assert.ok(Math.floor(J.jam / 2) > 0);
  spawnUnit(s.world, 1, "jammer", foe.x + Math.floor(J.jam / 2), Y);
  assert.equal(levelFor(s, 0, foe), "none");
  for (let i = 0; i < 300; i++) {
    step(s, []);
    assert.equal(gun.target, 0);
  }
  assert.equal(s.world.projectiles.length, 0);
  assert.equal(foe.hp, UNIT_STATS.tank.maxHp);
});
