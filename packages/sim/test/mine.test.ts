import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnUnit, step, UNIT_STATS } from "../src/index.ts";
import { buildGrid } from "../src/grid.ts";
import { mapSize } from "../src/mapSize.ts";
import { densestEnemy } from "../src/targeting.ts";
import { detect, everything } from "../src/detection.ts";
import { deaths } from "../src/systems/deaths.ts";
import { freshState, TINY } from "./helpers.ts";

test("a mine blows up when an enemy is in range and hurts it", () => {
  const s = freshState(1, TINY);
  spawnUnit(s.world, 0, "mine", 1000, 1000);
  const foe = spawnUnit(s.world, 1, "tank", 1000 + UNIT_STATS.mine.range - 10, 1000);
  step(s, []);
  step(s, []);
  assert.equal(s.world.units.some((u) => u.kind === "mine"), false);
  assert.ok(foe.hp < UNIT_STATS.tank.maxHp);
});

test("a mine ignores an enemy out of range", () => {
  const s = freshState(1, TINY);
  spawnUnit(s.world, 0, "mine", 1000, 1000);
  spawnUnit(s.world, 1, "tank", 1000 + UNIT_STATS.mine.range * 3, 1000);
  step(s, []);
  assert.equal(s.world.units.some((u) => u.kind === "mine"), true);
});

test("a sieged mine uses the shorter landmine range", () => {
  const s = freshState(1, TINY);
  const m = spawnUnit(s.world, 0, "mine", 1000, 1000);
  m.mode = "sieged";
  spawnUnit(s.world, 1, "tank", 1000 + (UNIT_STATS.mine.range + UNIT_STATS.mine.siegeRange) / 2, 1000);
  step(s, []);
  assert.equal(s.world.units.some((u) => u.kind === "mine"), true);
});

test("a mine picks the enemy in the bigger group over a nearer loner", () => {
  const s = freshState(1, TINY);
  const m = spawnUnit(s.world, 0, "mine", 1000, 1000);
  const loner = spawnUnit(s.world, 1, "tank", 1200, 1000);
  const a = spawnUnit(s.world, 1, "tank", 1000, 1300);
  spawnUnit(s.world, 1, "tank", 1030, 1300);
  spawnUnit(s.world, 1, "tank", 1000, 1330);
  const grid = buildGrid(s.world.units, mapSize(s.world.terrain));
  const shot = densestEnemy(s.world, grid, everything, m, 400, 0, [], UNIT_STATS.mine.deathRadius);
  assert.notEqual(shot?.t.id, loner.id);
  assert.ok(shot && shot.t.y >= a.y - 1);
});

test("a sieged mine blasts for its siege damage, a mobile one for its death damage", () => {
  for (const [mode, want] of [["mobile", UNIT_STATS.mine.deathDamage], ["sieged", UNIT_STATS.mine.siegeDamage]] as const) {
    const s = freshState(1, TINY);
    const m = spawnUnit(s.world, 0, "mine", 1000, 1000);
    m.mode = mode;
    m.hp = 0;
    deaths(s);
    assert.equal(s.world.blasts[0]?.damage, want);
  }
});

test("a sieged mine is unseen by enemies in sight and radar, a mobile one is seen", () => {
  for (const [mode, want] of [["mobile", "seen"], ["sieged", "none"]] as const) {
    const s = freshState(1, TINY);
    const m = spawnUnit(s.world, 0, "mine", 1000, 1000);
    m.mode = mode;
    spawnUnit(s.world, 1, "tank", 1050, 1000);
    const d = detect(s.world, buildGrid(s.world.units, mapSize(s.world.terrain)));
    assert.equal(d.level(1, m), want);
  }
});
