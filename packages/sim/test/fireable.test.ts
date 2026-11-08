import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnUnit, type MoveOrder, type SimState, type Unit } from "../src/index.ts";
import { buildGrid } from "../src/grid.ts";
import { mapSize } from "../src/mapSize.ts";
import { canFire } from "../src/fireable.ts";
import { detect } from "../src/detection.ts";
import { engage } from "../src/systems/engage.ts";
import { combat } from "../src/systems/combat.ts";
import { freshState, TINY } from "./helpers.ts";

const GROUND = 500;
/** The vertex column the ridge stands on: x = 625 on TINY. */
const RIDGE_COL = 5;

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

const attackMove = (): MoveOrder =>
  ({ type: "move", x: 300, y: 1900, group: 0, attack: true, path: [], best: 0, stall: 0, skip: 0 });

const gridOf = (s: SimState) => buildGrid(s.world.units, mapSize(s.world.terrain));
const runEngage = (s: SimState) => { const g = gridOf(s); engage(s.world, g, detect(s.world, g)); };
const runCombat = (s: SimState) => { const g = gridOf(s); combat(s.world, g, detect(s.world, g)); };

function engagedOn(u: Unit): number {
  const o = u.orders[0];
  return o?.type === "engage" ? o.target : 0;
}

test("an attack-move engages a clear enemy past a nearer one behind a ridge", () => {
  const s = map(200);
  const u = spawnUnit(s.world, 0, "tank", 300, 1000);
  u.orders = [attackMove()];
  spawnUnit(s.world, 1, "tank", 900, 1000);
  const b = spawnUnit(s.world, 1, "tank", 300, 60);
  runEngage(s);
  assert.equal(engagedOn(u), b.id);
});

test("an attack-move does not stop for an enemy it cannot fire on", () => {
  const s = map(200);
  const u = spawnUnit(s.world, 0, "tank", 300, 1000);
  u.orders = [attackMove()];
  spawnUnit(s.world, 1, "tank", 900, 1000);
  runEngage(s);
  assert.equal(u.orders[0]?.type, "move");
});

test("an engage ends when its target moves behind a ridge, then the next clear enemy is engaged", () => {
  const s = map(200);
  const u = spawnUnit(s.world, 0, "tank", 300, 1000);
  u.orders = [attackMove()];
  const a = spawnUnit(s.world, 1, "tank", 300, 500);
  const c = spawnUnit(s.world, 1, "tank", 300, 1800);
  runEngage(s);
  assert.equal(engagedOn(u), a.id);
  a.x = 900; a.y = 1000;
  runEngage(s);
  assert.equal(u.orders[0]?.type, "move");
  runEngage(s);
  assert.equal(engagedOn(u), c.id);
});

for (const sieged of [false, true]) {
  test(`an engage ends when its target moves inside artillery minRange (${sieged ? "sieged" : "mobile"})`, () => {
    const s = map();
    const u = spawnUnit(s.world, 0, "artillery", 300, 1000);
    const t = spawnUnit(s.world, 1, "tank", 800, 1000);
    if (sieged) u.mode = "sieged";
    u.orders = [{ type: "engage", target: t.id, hold: false, x: u.x, y: u.y }, attackMove()];
    runEngage(s);
    assert.equal(engagedOn(u), t.id);
    t.x = 500;
    runEngage(s);
    assert.equal(u.orders[0]?.type, "move");
  });
}

test("a guard skips the blocked enemy nearest its charge for another one near the charge", () => {
  const s = map(200);
  const g = spawnUnit(s.world, 0, "tank", 300, 1000);
  const u = spawnUnit(s.world, 0, "tank", 300, 1100);
  u.orders = [{ type: "guard", target: g.id, chase: false }];
  spawnUnit(s.world, 1, "tank", 850, 1000);
  const b = spawnUnit(s.world, 1, "tank", 300, 420);
  spawnUnit(s.world, 1, "tank", 300, 1750);
  runCombat(s);
  assert.equal(u.target, b.id);
});

test("a guard with only blocked enemies targets nothing", () => {
  const s = map(200);
  const g = spawnUnit(s.world, 0, "tank", 300, 1000);
  const u = spawnUnit(s.world, 0, "tank", 300, 1100);
  u.orders = [{ type: "guard", target: g.id, chase: false }];
  spawnUnit(s.world, 1, "tank", 850, 1000);
  runCombat(s);
  assert.equal(u.target, 0);
});

test("canFire: false unarmed or behind a ridge, true on open ground", () => {
  const blocked = map(200);
  const e = spawnUnit(blocked.world, 0, "engineer", 300, 1000);
  const tank = spawnUnit(blocked.world, 0, "tank", 300, 1000);
  const far = spawnUnit(blocked.world, 1, "tank", 900, 1000);
  const clear = spawnUnit(blocked.world, 1, "tank", 300, 500);
  assert.equal(canFire(blocked.world, e, clear), false);
  assert.equal(canFire(blocked.world, tank, far), false);
  assert.equal(canFire(blocked.world, tank, clear), true);
});
