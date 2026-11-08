import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnUnit, step, UNIT_STATS, type Intent, type SimState } from "../src/index.ts";
import { buildGrid } from "../src/grid.ts";
import { mapSize } from "../src/mapSize.ts";
import { detect, type Detection } from "../src/detection.ts";
import { combat } from "../src/systems/combat.ts";
import { freshState, TINY, WIDE } from "./helpers.ts";

// A unit may only target an enemy its team detects. Sieged artillery outranges its own sight and radar:
// at 2000 it is in weapon range of a target it cannot detect alone.

const Y = 4000;
const GUN_X = 2000;
const FOE_X = GUN_X + 2000;

function flat(p = WIDE): SimState {
  return freshState(1, p, (spec) => {
    spec.heights.fill(500);
    spec.features = [];
    spec.fields = [];
  });
}

/** Sieged artillery of player 0 and a tank of player 1, 2000 apart: in range, not detected. */
function outranged() {
  const A = UNIT_STATS.artillery;
  assert.ok(FOE_X - GUN_X > Math.max(A.sight, A.siegeRadar) && FOE_X - GUN_X <= A.siegeRange);
  const s = flat();
  const gun = spawnUnit(s.world, 0, "artillery", GUN_X, Y);
  gun.mode = "sieged";
  const foe = spawnUnit(s.world, 1, "tank", FOE_X, Y);
  return { s, gun, foe };
}

const send = (s: SimState, player: number, intent: Intent) => step(s, [{ player, intent }]);

/** Player 0's radar truck beside `foe`: outside its own sight, inside its radar. */
function radarBeside(s: SimState, foe: { x: number }) {
  const R = UNIT_STATS.radar;
  assert.ok(R.sight + 200 < R.radar);
  return spawnUnit(s.world, 0, "radar", foe.x - R.sight - 200, Y);
}

test("sieged artillery does not fire at an enemy in range that its team does not detect", () => {
  const { s, gun, foe } = outranged();
  for (let i = 0; i < 120; i++) {
    step(s, []);
    assert.equal(gun.target, 0);
  }
  assert.equal(s.world.projectiles.length, 0);
  assert.equal(foe.hp, UNIT_STATS.tank.maxHp);
});

test("sieged artillery hits a radar-only target once a friendly radar truck covers it", () => {
  const { s, gun, foe } = outranged();
  radarBeside(s, foe);
  const seen = detect(s.world, buildGrid(s.world.units, mapSize(s.world.terrain)));
  assert.equal(seen.level(0, foe), "radar");
  for (let i = 0; i < 300 && foe.hp === UNIT_STATS.tank.maxHp; i++) step(s, []);
  assert.equal(gun.target, foe.id);
  assert.ok(foe.hp < UNIT_STATS.tank.maxHp, "the shell never hit");
});

test("an attack intent on an undetected enemy gives no order", () => {
  const { s, gun, foe } = outranged();
  send(s, 0, { t: "attack", units: [gun.id], target: foe.id, queue: false });
  assert.equal(gun.orders.length, 0);
});

test("an attack order turns into a move to the target's last detected spot when the target leaves detection", () => {
  const s = flat();
  const u = spawnUnit(s.world, 0, "tank", GUN_X, Y);
  const foe = spawnUnit(s.world, 1, "tank", GUN_X + 1000, Y);
  send(s, 0, { t: "attack", units: [u.id], target: foe.id, queue: false });
  assert.equal(u.orders[0]?.type, "attack");
  foe.x = FOE_X;
  step(s, []);
  const o = u.orders[0];
  assert.equal(o?.type, "move");
  assert.ok(o?.type === "move" && o.x === GUN_X + 1000 && o.y === Y && !o.attack);
  assert.equal(u.orders.length, 1);
});

test("a queued attack whose target went dark long before moves the unit to the last detected spot", () => {
  const s = flat();
  const u = spawnUnit(s.world, 0, "tank", GUN_X, Y);
  const foe = spawnUnit(s.world, 1, "tank", GUN_X + 1000, Y);
  send(s, 0, { t: "move", units: [u.id], x: GUN_X, y: Y - 2000, force: false, queue: false, attack: false });
  send(s, 0, { t: "attack", units: [u.id], target: foe.id, queue: true });
  assert.equal(u.orders[1]?.type, "attack");
  foe.x = 20000;
  let ticks = 0;
  for (; ticks < 2000 && u.orders[0]?.type === "move"; ticks++) step(s, []);
  assert.equal(u.orders[0]?.type, "attack");
  assert.ok(ticks > 30, `the move took ${ticks} ticks`);
  step(s, []);
  const o = u.orders[0];
  assert.ok(o?.type === "move" && o.x === GUN_X + 1000 && o.y === Y && !o.attack, "drives to the stored spot");
  assert.equal(foe.x, 20000);
});

test("a sieged unit whose attack target goes dark keeps its mode and drops the order", () => {
  const { s, gun, foe } = outranged();
  const radar = radarBeside(s, foe);
  send(s, 0, { t: "attack", units: [gun.id], target: foe.id, queue: false });
  assert.equal(gun.orders[0]?.type, "attack");
  radar.x = 20000;
  for (let i = 0; i < 30; i++) {
    step(s, []);
    assert.equal(gun.mode, "sieged");
  }
  assert.equal(gun.orders.length, 0);
});

test("detection is one answer per tick: a mine that detonates first still lets its team see the tank", () => {
  const targetOf = (mineFirst: boolean): number => {
    const s = flat();
    const spawnMine = () => spawnUnit(s.world, 0, "mine", FOE_X + 50, Y);
    const spawnGun = () => { const g = spawnUnit(s.world, 0, "artillery", GUN_X, Y); g.mode = "sieged"; return g; };
    const mine = mineFirst ? spawnMine() : undefined;
    const gun = spawnGun();
    const m = mine ?? spawnMine();
    const foe = spawnUnit(s.world, 1, "tank", FOE_X, Y);
    step(s, []);
    assert.equal(m.hp, 0, "the mine detonated this tick");
    assert.equal(gun.target, foe.id, `mine first: ${mineFirst}`);
    return gun.target;
  };
  assert.equal(targetOf(true), targetOf(false));
});

test("a dead unit does not fire", () => {
  const s = flat(TINY);
  const tank = spawnUnit(s.world, 0, "tank", 1000, 1000);
  spawnUnit(s.world, 0, "harvester", 1000, 1200);
  spawnUnit(s.world, 1, "tank", 1300, 1000);
  tank.hp = 0;
  for (let i = 0; i < 60; i++) {
    const g = buildGrid(s.world.units, mapSize(s.world.terrain));
    combat(s.world, g, detect(s.world, g));
    assert.equal(tank.target, 0);
  }
  assert.equal(s.world.projectiles.filter((p) => p.shooter === tank.id).length, 0);
});

/** Detects nothing: proves a mine targets without detection. */
const nothing: Detection = { level: () => "none", detects: () => false };

test("a mine blows up on an enemy its team does not detect; a tank does not fire on one", () => {
  const s = flat(TINY);
  const m = spawnUnit(s.world, 0, "mine", 1000, 1000);
  const tank = spawnUnit(s.world, 0, "tank", 1000, 1300);
  spawnUnit(s.world, 1, "tank", 1000 + UNIT_STATS.mine.range - 10, 1000);
  combat(s.world, buildGrid(s.world.units, mapSize(s.world.terrain)), nothing);
  assert.equal(m.hp, 0);
  assert.equal(tank.target, 0);
});
