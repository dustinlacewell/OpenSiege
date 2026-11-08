import { test } from "node:test";
import assert from "node:assert/strict";
import { heightAt, PROJ_FP, spawnUnit, step, UNIT_STATS, type Projectile, type SimState } from "../src/index.ts";
import { freshState, seat, TINY } from "./helpers.ts";

// Players 0 and 1 are allies on team 5. Player 2 is on team 6. A blast hurts all of them.

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

/** A shell of unit `shooter` at (x, y), `z` world units up, moving (vx, vy) world units a tick. */
function shell(source: Projectile["source"], shooter: number, x: number, y: number, z: number, vx: number, vy: number, splash: number): Projectile {
  return { id: 900, owner: 0, shooter, source, x: x * PROJ_FP, y: y * PROJ_FP, z: z * PROJ_FP, vx: vx * PROJ_FP, vy: vy * PROJ_FP, vz: 0, damage: 100, splash, dig: 0, ttl: 50 };
}

test("a shell splash hurts the shooter's own unit and an ally in the radius", () => {
  const s = flat();
  const own = spawnUnit(s.world, 0, "harvester", 1050, 1000);
  const ally = spawnUnit(s.world, 1, "harvester", 1000, 1050);
  const foe = spawnUnit(s.world, 2, "harvester", 950, 1000);
  s.world.projectiles.push(shell("artillery", own.id, 1000, 1000, 0, 0, 0, 200));
  step(s, []);
  const full = UNIT_STATS.harvester.maxHp;
  assert.ok(own.hp < full, "own unit unhurt");
  assert.ok(ally.hp < full, "ally unhurt");
  assert.ok(foe.hp < full, "enemy unhurt");
  assert.equal(s.world.projectiles.length, 0);
});

/** A direct shell flying east at body height from (x, 1000). */
function direct(s: SimState, shooter: number, x: number): Projectile {
  const z = heightAt(s.world.terrain, x, 1000) + Math.floor(UNIT_STATS.tank.height / 2);
  return shell("tank", shooter, x, 1000, z, 40, 0, 0);
}

test("a direct shell stops at an ally's body in its path", () => {
  const s = flat();
  const own = spawnUnit(s.world, 0, "tank", 500, 1000);
  const ally = spawnUnit(s.world, 1, "tank", 700, 1000);
  s.world.projectiles.push(direct(s, own.id, 640));
  step(s, []);
  assert.equal(ally.hp, UNIT_STATS.tank.maxHp - 100);
  assert.equal(s.world.projectiles.length, 0);
});

test("a direct shell passes through the unit that fired it", () => {
  const s = flat();
  const own = spawnUnit(s.world, 0, "tank", 1000, 1000);
  s.world.projectiles.push(direct(s, own.id, 1000));
  step(s, []);
  assert.equal(own.hp, UNIT_STATS.tank.maxHp);
  assert.equal(s.world.projectiles.length, 1);
});

test("a direct shell stops at another unit of its own player", () => {
  const s = flat();
  const a = spawnUnit(s.world, 0, "tank", 500, 1000);
  const b = spawnUnit(s.world, 0, "tank", 700, 1000);
  s.world.projectiles.push(direct(s, a.id, 640));
  step(s, []);
  assert.equal(b.hp, UNIT_STATS.tank.maxHp - 100);
});

test("a death blast hurts a teammate and an enemy of the dead unit", () => {
  const s = flat();
  spawnUnit(s.world, 0, "tank", 1000, 1000).hp = 0;
  const ally = spawnUnit(s.world, 1, "harvester", 1020, 1000);
  const foe = spawnUnit(s.world, 2, "harvester", 980, 1000);
  // Sieged, so the scrap the dead tank leaves does not push them out of the blast (`featureContact`).
  ally.mode = "sieged";
  foe.mode = "sieged";
  step(s, []);
  step(s, []);
  assert.ok(ally.hp < UNIT_STATS.harvester.maxHp, "ally unhurt");
  assert.ok(foe.hp < UNIT_STATS.harvester.maxHp, "enemy unhurt");
});
