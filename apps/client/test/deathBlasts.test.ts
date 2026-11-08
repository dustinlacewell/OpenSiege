import { test } from "node:test";
import assert from "node:assert/strict";
import { PROJ_FP, type Terrain, type World } from "@mf/sim";
import { DeathBlasts } from "../src/game/deathBlasts.ts";

const terrain: Terrain = { cols: 3, rows: 3, cell: 100, heights: new Array(9).fill(10), seaLevel: 0 };

function world(tick: number, blasts: World["blasts"]): Pick<World, "tick" | "blasts" | "terrain"> {
  return { tick, blasts, terrain };
}

const blast = { x: 120 * PROJ_FP, y: 80 * PROJ_FP, z: 30 * PROJ_FP, damage: 50, radius: 40, owner: 1 };

test("a new tick gives one request per blast in world units, sized by radius", () => {
  const d = new DeathBlasts();
  d.skip(4);
  const low = { ...blast, x: 20 * PROJ_FP, z: 0 };
  assert.deepEqual(d.take(world(5, [blast, low])), [
    { x: 120, y: 80, z: 30, splash: 40 },
    { x: 20, y: 80, z: 10, splash: 40 },
  ]);
});

test("the same tick twice gives nothing the second time, and skip hides the current list", () => {
  const d = new DeathBlasts();
  d.skip(4);
  assert.equal(d.take(world(5, [blast])).length, 1);
  assert.equal(d.take(world(5, [blast])).length, 0);
  d.skip(9);
  assert.equal(d.take(world(9, [blast])).length, 0);
  assert.equal(d.take(world(10, [])).length, 0);
});
