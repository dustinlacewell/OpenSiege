import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnUnit, step, UNIT_STATS, type Intent, type SimState, type Unit } from "../src/index.ts";
import { spawnPlayer } from "../src/spawn.ts";
import { freshState, seat, TINY } from "./helpers.ts";

// Players 0 and 1 are allies on team 5. Player 2 is on team 6.

function flat(): SimState {
  const s = freshState(1, TINY, (spec) => {
    spec.heights.fill(500);
    spec.features = [];
    spec.fields = [];
  });
  seat(s, 0, 5);
  seat(s, 1, 5);
  seat(s, 2, 6);
  return s;
}

/** A tank of player 0 at (1000, 1000) and a tank of `other` 150 east of it, close enough to fire on. */
function pair(other: number): { s: SimState; u: Unit; t: Unit } {
  const s = flat();
  const u = spawnUnit(s.world, 0, "tank", 1000, 1000);
  const t = spawnUnit(s.world, other, "tank", 1150, 1000);
  return { s, u, t };
}

const send = (s: SimState, player: number, intent: Intent) => step(s, [{ player, intent }]);

test("an armed unit never auto-targets or fires on an ally", () => {
  const { s, u, t } = pair(1);
  for (let i = 0; i < 40; i++) {
    step(s, []);
    assert.equal(u.target, 0);
    assert.equal(t.target, 0);
  }
  assert.equal(s.world.projectiles.length, 0);
  assert.equal(u.hp, UNIT_STATS.tank.maxHp);
  assert.equal(t.hp, UNIT_STATS.tank.maxHp);
});

test("an armed unit auto-targets an enemy of another team", () => {
  const { s, u, t } = pair(2);
  let aimed = false;
  for (let i = 0; i < 40 && !aimed; i++) {
    step(s, []);
    aimed = u.target === t.id;
  }
  assert.ok(aimed, "never targeted the enemy");
});

/** Attack-move `u` to the far corner and run `n` ticks; true when it ever took an engage order. */
function engages(s: SimState, u: Unit, n: number): boolean {
  send(s, 0, { t: "move", units: [u.id], x: 1900, y: 1000, force: false, queue: false, attack: true });
  for (let i = 0; i < n; i++) {
    if (u.orders.some((o) => o.type === "engage")) return true;
    step(s, []);
  }
  return false;
}

test("an attack-move does not engage an ally", () => {
  const { s, u } = pair(1);
  assert.equal(engages(s, u, 40), false);
});

test("an attack-move engages an enemy", () => {
  const { s, u } = pair(2);
  assert.equal(engages(s, u, 40), true);
});

/** A guard of player 0 at (1200, 1000) on a charge at (1000, 1000), and a tank of `other` 100 from the charge. */
function guarding(other: number): { s: SimState; g: Unit; foe: Unit } {
  const s = flat();
  const charge = spawnUnit(s.world, 0, "tank", 1000, 1000);
  const g = spawnUnit(s.world, 0, "tank", 1200, 1000);
  g.orders = [{ type: "guard", target: charge.id, chase: false }];
  const foe = spawnUnit(s.world, other, "tank", 1000, 1100);
  return { s, g, foe };
}

test("a guard ignores an ally near its charge", () => {
  const { s, g, foe } = guarding(1);
  for (let i = 0; i < 40; i++) {
    step(s, []);
    assert.equal(g.target, 0);
  }
  assert.equal(foe.hp, UNIT_STATS.tank.maxHp);
});

test("a guard fires on an enemy near its charge", () => {
  const { s, g, foe } = guarding(2);
  let aimed = false;
  for (let i = 0; i < 40 && !aimed; i++) {
    step(s, []);
    aimed = g.target === foe.id;
  }
  assert.ok(aimed, "guard never targeted the enemy");
});

test("an attack order on an ally does nothing; on an enemy it is given", () => {
  const { s, u, t } = pair(1);
  send(s, 0, { t: "attack", units: [u.id], target: t.id, queue: false });
  assert.equal(u.orders.length, 0);
  const foe = spawnUnit(s.world, 2, "tank", 1500, 1500);
  send(s, 0, { t: "attack", units: [u.id], target: foe.id, queue: false });
  assert.equal(u.orders[0]?.type, "attack");
});

test("a spawn point is scored by the nearest enemy, not the nearest teammate", () => {
  for (const seed of [1, 2, 3]) {
    const bare = freshState(seed, TINY);
    seat(bare, 0, 5);
    spawnPlayer(bare.world, 0);
    const at = bare.world.units.filter((u) => u.owner === 0)[1]!;

    const withAlly = freshState(seed, TINY);
    seat(withAlly, 0, 5);
    seat(withAlly, 1, 5);
    spawnUnit(withAlly.world, 1, "tank", at.x, at.y);
    spawnPlayer(withAlly.world, 0);
    const mine = withAlly.world.units.filter((u) => u.owner === 0)[1]!;
    assert.deepEqual({ x: mine.x, y: mine.y }, { x: at.x, y: at.y }, `seed ${seed}`);
  }
});
