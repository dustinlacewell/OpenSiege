import { test } from "node:test";
import assert from "node:assert/strict";
import { GRAVITY, PROJ_FP, type Projectile } from "@mf/sim";
import { launchPoint, shotAt } from "../src/game/interp.ts";

const shell: Projectile = {
  id: 1, owner: 0, source: "artillery",
  x: 200 * PROJ_FP, y: 100 * PROJ_FP, z: 40 * PROJ_FP,
  vx: 0, vy: 0, vz: 0, damage: 1, splash: 0, dig: 0, ttl: 10,
};

test("shotAt lerps from the previous position in world units, clamps alpha, and holds still without one", () => {
  const prev = { x: 100 * PROJ_FP, y: 100 * PROJ_FP, z: 20 * PROJ_FP };
  assert.deepEqual(shotAt({ x: 0, y: 0, z: 0 }, shell, prev, 0.25), { x: 125, y: 100, z: 25 });
  assert.deepEqual(shotAt({ x: 0, y: 0, z: 0 }, shell, prev, 3), { x: 200, y: 100, z: 40 });
  assert.deepEqual(shotAt({ x: 0, y: 0, z: 0 }, shell, undefined, 0.5), { x: 200, y: 100, z: 40 });
});

test("launchPoint undoes one tick of flight, gravity included", () => {
  // After one tick: pos = tip + v0, vz = v0z - GRAVITY. So tip = pos - (vx, vy, vz + GRAVITY).
  const tip = { x: 100 * PROJ_FP, y: 50 * PROJ_FP, z: 30 * PROJ_FP };
  const v0 = { x: 64, y: -32, z: 200 };
  const flown: Projectile = { ...shell, x: tip.x + v0.x, y: tip.y + v0.y, z: tip.z + v0.z, vx: v0.x, vy: v0.y, vz: v0.z - GRAVITY };
  assert.deepEqual(launchPoint(flown), tip);
  const p = launchPoint(flown);
  assert.deepEqual(shotAt({ x: 0, y: 0, z: 0 }, flown, p, 0), { x: tip.x / PROJ_FP, y: tip.y / PROJ_FP, z: tip.z / PROJ_FP });
  assert.deepEqual(shotAt({ x: 0, y: 0, z: 0 }, flown, p, 1), { x: flown.x / PROJ_FP, y: flown.y / PROJ_FP, z: flown.z / PROJ_FP });
});
