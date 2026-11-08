import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnUnit, step, UNIT_STATS, type SimState, type Unit, type UnitKind } from "../src/index.ts";
import { canFire } from "../src/fireable.ts";
import { freshState, TINY } from "./helpers.ts";

const GROUND = 500;

/** Flat ground at GROUND; every row has `rise` added at vertex columns `cols` (x = col · 125 on TINY). */
function map(cols: number[], rise: number): SimState {
  return freshState(1, TINY, (spec) => {
    spec.heights.fill(GROUND);
    const w = spec.width / spec.cell + 1;
    for (let i = 0; i < spec.heights.length; i += w) for (const c of cols) spec.heights[i + c] = GROUND + rise;
    spec.features = [];
    spec.fields = [];
  });
}

/** A pit 200 deep at x 1000..1125: from the flat ground only its rim sees in. */
const pit = () => map([8, 9], -200);
/** A wall 800 high at x 875..1000: nothing on the near side sees past it. */
const wall = () => map([7, 8], 800);
const flat = () => map([], 0);

/** A `kind` at (x, 1000) ordered to attack an unarmed enemy at (tx, 1000). */
function setup(s: SimState, kind: UnitKind, x: number, tx: number): { u: Unit; foe: Unit } {
  const u = spawnUnit(s.world, 0, kind, x, 1000);
  const foe = spawnUnit(s.world, 1, "harvester", tx, 1000);
  step(s, [{ player: 0, intent: { t: "attack", units: [u.id], target: foe.id, queue: false } }]);
  return { u, foe };
}

function run(s: SimState, ticks: number): void {
  for (let t = 0; t < ticks; t++) step(s, []);
}

/** Asserts `u` does not move over the next `ticks` ticks. */
function assertStill(s: SimState, u: Unit, ticks: number): void {
  for (let t = 0; t < ticks; t++) {
    const x = u.x, y = u.y;
    step(s, []);
    assert.ok(Math.hypot(u.x - x, u.y - y) < 1, `tick ${t} moved`);
  }
}

test("a tank attacking a target it cannot hit closes in until it can, then fires and holds", () => {
  const s = pit();
  const { u, foe } = setup(s, "tank", 450, 1060);
  assert.equal(canFire(s.world, u, foe), false);
  for (let t = 0; t < 300 && foe.hp === UNIT_STATS.harvester.maxHp; t++) step(s, []);
  assert.ok(foe.hp < UNIT_STATS.harvester.maxHp, `foe hp ${foe.hp}`);
  assert.ok(u.x > 450, `tank x ${u.x}`);
  assert.equal(canFire(s.world, u, foe), true);
  assert.equal(u.orders[0]?.type, "attack");
  assertStill(s, u, 50);
});

test("a tank with a clear shot holds where it stands", () => {
  const s = flat();
  const { u, foe } = setup(s, "tank", 450, 1050);
  run(s, 200);
  assert.equal(u.x, 450);
  assert.equal(u.y, 1000);
  assert.ok(foe.hp < UNIT_STATS.harvester.maxHp, `foe hp ${foe.hp}`);
});

test("with no arc anywhere the tank closes until stopped, then stays still", () => {
  const s = wall();
  const { u, foe } = setup(s, "tank", 500, 1100);
  run(s, 300);
  assert.ok(u.x > 500, `tank x ${u.x}`);
  const contact = UNIT_STATS.tank.radius + UNIT_STATS.harvester.radius;
  assert.ok(Math.hypot(u.x - foe.x, u.y - foe.y) >= contact - 1, `gap below contact`);
  assert.equal(canFire(s.world, u, foe), false);
  assertStill(s, u, 50);
});

test("artillery lobbing into the pit holds where it stands", () => {
  const s = pit();
  const { u, foe } = setup(s, "artillery", 560, 1060);
  assert.equal(canFire(s.world, u, foe), true);
  run(s, 300);
  assert.equal(u.x, 560);
  assert.equal(u.y, 1000);
  const o = u.orders[0];
  assert.ok(o?.type === "attack" && o.hold, "holding the attack");
});
