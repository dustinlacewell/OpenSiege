import { test } from "node:test";
import assert from "node:assert/strict";
import { PROJ_FP, type Projectile, type World } from "@mf/sim";
import type { DecalStamp } from "../src/game/decalStamps.ts";
import { SmokeField } from "../src/game/smoke.ts";

const ALL = { sees: () => true };
const NONE = { sees: () => false };

function flatWorld(): World {
  const terrain = { cols: 3, rows: 3, cell: 1000, heights: new Array(9).fill(0), seaLevel: 0 };
  return { tick: 0, terrain, projectiles: [] } as unknown as World;
}

function shell(z: number, splash: number): Projectile {
  return {
    id: 1, owner: 0, source: "artillery",
    x: 500 * PROJ_FP, y: 600 * PROJ_FP, z: z * PROJ_FP,
    vx: 0, vy: 0, vz: 0, damage: 1, splash, ttl: 10,
  } as Projectile;
}

/** One shell flies for a tick, then is gone: the field sees it burst. */
function burst(field: SmokeField, world: World, p: Projectile): void {
  field.update(world, 0);
  world.tick = 1;
  world.projectiles.push(p);
  field.update(world, 0.05);
  world.tick = 2;
  world.projectiles.length = 0;
  field.update(world, 0.1);
}

function drained(field: SmokeField, sight = ALL): DecalStamp[] {
  const out: DecalStamp[] = [];
  field.stamps.drain(sight, (s) => out.push(s));
  return out;
}

test("a ground burst queues one stamp with radius splash · 0.9 at the impact point", () => {
  const field = new SmokeField();
  burst(field, flatWorld(), shell(10, 100));
  const stamps = drained(field);
  assert.equal(stamps.length, 1);
  assert.deepEqual([stamps[0]!.x, stamps[0]!.y, stamps[0]!.radius], [500, 600, 90]);
  assert.equal(field.stamps.count, 0);
});

test("an air burst queues no stamp", () => {
  const field = new SmokeField();
  burst(field, flatWorld(), shell(500, 100));
  assert.equal(field.stamps.count, 0);
});

test("draining drops stamps the local player does not see and empties the queue", () => {
  const field = new SmokeField();
  burst(field, flatWorld(), shell(10, 100));
  assert.equal(drained(field, NONE).length, 0);
  assert.equal(field.stamps.count, 0);
});

test("a new world clears queued stamps", () => {
  const field = new SmokeField();
  burst(field, flatWorld(), shell(10, 100));
  assert.equal(field.stamps.count, 1);
  field.update(flatWorld(), 0.2);
  assert.equal(field.stamps.count, 0);
});
