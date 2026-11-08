import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnUnit, step, UNIT_STATS, type SimState } from "../src/index.ts";
import { arcClear, arcOver, pitchSlope, solveArc } from "../src/arc.ts";
import { PROJ_FP } from "../src/stats.ts";
import { freshState, TINY } from "./helpers.ts";

const GROUND = 500;
/** The vertex column the ridge stands on: x = 625 on TINY. */
const RIDGE_COL = 5;
const CAP = pitchSlope(UNIT_STATS.tank.maxPitch);

/** Flat open ground at GROUND, with a north-south ridge `rise` high at RIDGE_COL. */
function map(rise = 0): SimState {
  return freshState(1, TINY, (spec) => {
    spec.heights.fill(GROUND);
    const cols = spec.width / spec.cell + 1;
    for (let i = RIDGE_COL; i < spec.heights.length; i += cols) spec.heights[i] = GROUND + rise;
    spec.features = [];
    spec.fields = [];
  });
}

const fp = (x: number, y: number, z: number) => ({ x: x * PROJ_FP, y: y * PROJ_FP, z: z * PROJ_FP });
/** Tank muzzle at x = 300 and the middle of a tank at x = 950, both on y = 1000. */
const FROM = fp(300, 1000, GROUND + 35);
const TO = fp(950, 1000, GROUND + 25);
const LOWEST = Math.ceil((650 * PROJ_FP) / (UNIT_STATS.tank.shotSpeed * PROJ_FP));

test("a tank hits an enemy tank near the end of its range on flat ground", () => {
  const s = map();
  const u = spawnUnit(s.world, 0, "tank", 300, 1000);
  const foe = spawnUnit(s.world, 1, "tank", 950, 1000);
  foe.cooldown = 1000;
  step(s, []);
  assert.ok(u.elevation >= -1000 && u.elevation <= CAP, `elevation ${u.elevation}`);
  for (let t = 0; t < 40; t++) step(s, []);
  assert.ok(foe.hp < UNIT_STATS.tank.maxHp);
});

test("solveArc lobs over a ridge the flat shot hits, within the cap", () => {
  const t = map(60).world.terrain;
  const flat = arcOver(TO.x - FROM.x, TO.y - FROM.y, TO.z - FROM.z, LOWEST);
  assert.equal(arcClear(t, FROM, flat), false);
  const arc = solveArc(t, FROM, TO, UNIT_STATS.tank.shotSpeed, CAP);
  assert.ok(arc && arc.elevation > flat.elevation && arc.elevation <= CAP);
});

test("solveArc finds nothing over a taller ridge or under a smaller cap", () => {
  assert.equal(solveArc(map(200).world.terrain, FROM, TO, UNIT_STATS.tank.shotSpeed, CAP), undefined);
  assert.equal(solveArc(map(60).world.terrain, FROM, TO, UNIT_STATS.tank.shotSpeed, 100), undefined);
});

test("a tank skips a nearer enemy behind a ridge for one it can hit", () => {
  const s = map(200);
  const u = spawnUnit(s.world, 0, "tank", 300, 1000);
  spawnUnit(s.world, 1, "tank", 900, 1000);
  const b = spawnUnit(s.world, 1, "tank", 300, 350);
  step(s, []);
  assert.equal(u.target, b.id);
  assert.ok(u.elevation >= -1000 && u.elevation <= CAP && u.elevation !== 0);
});

test("a tank holds fire when the only enemy is behind a ridge", () => {
  const s = map(200);
  const u = spawnUnit(s.world, 0, "tank", 300, 1000);
  spawnUnit(s.world, 1, "tank", 900, 1000);
  for (let t = 0; t < 20; t++) step(s, []);
  assert.equal(u.target, 0);
  assert.equal(u.elevation, 0);
  assert.equal(s.world.projectiles.length, 0);
});

test("artillery holds fire when a ridge blocks every lob to the only enemy", () => {
  const s = map(5000);
  const a = spawnUnit(s.world, 0, "artillery", 300, 1000);
  spawnUnit(s.world, 1, "tank", 800, 1000);
  for (let t = 0; t < 40; t++) step(s, []);
  assert.equal(a.target, 0);
  assert.equal(s.world.projectiles.length, 0);
});

test("artillery lobs higher than its lowest arc to clear a ridge", () => {
  const f = map();
  const flat = spawnUnit(f.world, 0, "artillery", 300, 1000);
  spawnUnit(f.world, 1, "tank", 800, 1000);
  const s = map(150);
  const a = spawnUnit(s.world, 0, "artillery", 300, 1000);
  spawnUnit(s.world, 1, "tank", 800, 1000);
  step(f, []);
  step(s, []);
  assert.notEqual(a.target, 0);
  assert.ok(a.elevation > flat.elevation, `${a.elevation} vs ${flat.elevation}`);
});

test("artillery sets its elevation to its arc's", () => {
  const s = map();
  const a = spawnUnit(s.world, 0, "artillery", 300, 1000);
  spawnUnit(s.world, 1, "tank", 800, 1000);
  step(s, []);
  assert.notEqual(a.target, 0);
  assert.ok(a.elevation > 0, `elevation ${a.elevation}`);
});
