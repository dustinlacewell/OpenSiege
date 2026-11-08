import { test } from "node:test";
import assert from "node:assert/strict";
import { GRAVITY, type Projectile, type SimState } from "@mf/sim";
import { launchPoint } from "../src/game/interp.ts";
import { Lockstep } from "../src/game/lockstep.ts";

function shell(id: number, x: number, z: number): Projectile {
  return { id, owner: 0, source: "tank", x, y: 0, z, vx: 80, vy: 0, vz: 40, damage: 1, splash: 0, dig: 0, ttl: 10 };
}

/** One tick of flight, as the sim's `fly` does it: pos += v, then vz -= GRAVITY. */
function fly(p: Projectile): void {
  p.x += p.vx; p.y += p.vy; p.z += p.vz;
  p.vz -= GRAVITY;
}

/** A Lockstep over a fake world whose step flies every shell, then runs `launch`. */
function rig(initial: Projectile[], launch: (tick: number, shots: Projectile[]) => void) {
  const world = { tick: 0, units: [], projectiles: initial };
  const sim = { world, terrainDirty: [] } as unknown as SimState;
  const step = (s: SimState): void => {
    const w = s.world;
    w.tick++;
    for (const p of w.projectiles) fly(p);
    launch(w.tick, w.projectiles);
  };
  const ls = new Lockstep(sim, { step, hash: () => 0, onHash: () => {} }, 0);
  const stepTo = (tick: number): void => {
    while (ls.expected <= tick) ls.receive({ tick: ls.expected, intents: [] }, 0);
    ls.update(1e6);
  };
  return { ls, world, stepTo };
}

test("a shell launched this step starts its draw at the launch point", () => {
  const { ls, world, stepTo } = rig([], (tick, shots) => {
    if (tick !== 1) return;
    const s = shell(7, 1000, 500);
    fly(s); // launched at the tip, then flown in the same tick
    shots.push(s);
  });
  stepTo(1);
  const s = world.projectiles[0]!;
  const p = ls.prevShots.get(7)!;
  assert.deepEqual({ x: p.x, y: p.y, z: p.z }, { x: 1000, y: 0, z: 500 });
  assert.deepEqual({ x: p.x, y: p.y, z: p.z }, launchPoint(s));
  stepTo(2);
  const q = ls.prevShots.get(7)!;
  assert.deepEqual({ x: q.x, y: q.y, z: q.z }, { x: 1080, y: 0, z: 540 }, "later steps record the real previous position");
});

test("a shell present at join is not backdated", () => {
  const { ls, stepTo } = rig([shell(3, 2000, 800)], () => {});
  assert.equal(ls.prevShots.has(3), false, "before any step it is drawn where it is");
  stepTo(1);
  const p = ls.prevShots.get(3)!;
  assert.deepEqual({ x: p.x, y: p.y, z: p.z }, { x: 2000, y: 0, z: 800 }, "its prev is where it was, not a launch point");
});
