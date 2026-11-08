import { test } from "node:test";
import assert from "node:assert/strict";
import { hashWorld, PROJ_FP, spawnUnit, step, UNIT_STATS, detonate, type Blast, type SimState } from "../src/index.ts";
import { NO_UNIT } from "../src/blast.ts";
import { buildGrid, type Grid } from "../src/grid.ts";
import { mapSize } from "../src/mapSize.ts";
import { freshState, TINY } from "./helpers.ts";

const gridOf = (s: SimState): Grid => buildGrid(s.world.units, mapSize(s.world.terrain));

function blastAt(x: number, y: number, damage: number, radius: number): Blast {
  return { x: x * PROJ_FP, y: y * PROJ_FP, z: 0, damage, radius, dig: 0 };
}

test("a blast hurts units of both players", () => {
  const s = freshState(1, TINY);
  const a = spawnUnit(s.world, 0, "tank", 1000, 1000);
  const b = spawnUnit(s.world, 1, "tank", 1020, 1000);
  detonate(s, gridOf(s), blastAt(1000, 1000, 100, 200), NO_UNIT, null, []);
  assert.ok(a.hp < UNIT_STATS.tank.maxHp);
  assert.ok(b.hp < UNIT_STATS.tank.maxHp);
});

test("a blast hurts two units of one player", () => {
  const s = freshState(1, TINY);
  const a = spawnUnit(s.world, 0, "tank", 1000, 1000);
  const b = spawnUnit(s.world, 0, "tank", 1020, 1000);
  detonate(s, gridOf(s), blastAt(1000, 1000, 100, 200), NO_UNIT, null, []);
  assert.ok(a.hp < UNIT_STATS.tank.maxHp);
  assert.ok(b.hp < UNIT_STATS.tank.maxHp);
});

/** Three tanks in a row, each inside the next one's death radius. The first is already dead. */
function chain(): SimState {
  const s = freshState(1, TINY);
  // One team, so no tank shoots another. The blasts alone do the killing.
  // Each tank is in the blast of the one before it, and the third is outside the first one's blast.
  // The two live tanks are sieged: a mobile unit would be pushed off the scrap the dead tank leaves (`featureContact`), out of the blast.
  const gap = (UNIT_STATS.tank.deathRadius * 5) / 8;
  const a = spawnUnit(s.world, 0, "tank", 1000, 1000);
  const b = spawnUnit(s.world, 0, "tank", 1000 + gap, 1000);
  const c = spawnUnit(s.world, 0, "tank", 1000 + 2 * gap, 1000);
  a.hp = 0;
  b.hp = 1;
  c.hp = 1;
  b.mode = "sieged";
  c.mode = "sieged";
  return s;
}

test("a chain of death blasts kills one unit per tick", () => {
  const s = chain();
  const left: number[] = [];
  for (let i = 0; i < 3; i++) {
    step(s, []);
    left.push(s.world.units.filter((u) => u.kind === "tank").length);
  }
  assert.deepEqual(left, [2, 1, 0]);
});

test("the same chain gives the same hash every tick", () => {
  const a = chain(), b = chain();
  for (let i = 0; i < 4; i++) {
    step(a, []);
    step(b, []);
    assert.equal(hashWorld(a.world), hashWorld(b.world));
  }
});

test("the hash sees queued blasts and dug entries", () => {
  const s = freshState(1, TINY);
  const base = hashWorld(s.world);
  s.world.blasts.push(blastAt(10, 10, 5, 50));
  const queued = hashWorld(s.world);
  assert.notEqual(queued, base);
  s.world.blasts.length = 0;
  s.world.dug[0] = (s.world.dug[0] ?? 0) + 1;
  assert.notEqual(hashWorld(s.world), base);
});
