import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnUnit, step, type SimState, type Unit, type UnitKind } from "../src/index.ts";
import { muzzleTip, type Mount } from "../src/muzzle.ts";
import { aim } from "../src/launch.ts";
import { GRAVITY } from "../src/stats.ts";
import type { Fp3 } from "../src/features/featureHit.ts";
import { freshState, TINY } from "./helpers.ts";

// A shell leaves the barrel as the client draws it at the step's start: the aim and elevation from before the tick.

const GROUND = 500;
const RANGE = 500;

function flat(): SimState {
  return freshState(1, TINY, (spec) => {
    spec.heights.fill(GROUND);
    spec.features = [];
    spec.fields = [];
  });
}

/** A `kind` at (300, 1000) in `mode`, with a harvester `RANGE` dead ahead along +x (bearing 0). */
function duel(kind: UnitKind, mode: Unit["mode"]): { s: SimState; u: Unit; t: Unit } {
  const s = flat();
  const u = spawnUnit(s.world, 0, kind, 300, 1000);
  u.mode = mode;
  const t = spawnUnit(s.world, 1, "harvester", 300 + RANGE, 1000);
  return { s, u, t };
}

/** The ideal elevation of `u` on `t`. */
function planned(s: SimState, u: Unit, t: Unit): number {
  const p = aim(s.world, u, t);
  assert.ok(p, "no plan");
  return p.arc.elevation;
}

interface Before { mount: Mount; aim: number; elevation: number }

/** One step; the spawn point of `u`'s new shell (one tick of flight back) and the unit before the step, if it fired. */
function stepShot(s: SimState, u: Unit): { from: Fp3; before: Before } | undefined {
  const before: Before = { mount: { kind: u.kind, x: u.x, y: u.y, facing: u.facing, mode: u.mode }, aim: u.aim, elevation: u.elevation };
  const seen = new Set(s.world.projectiles.map((p) => p.id));
  step(s, []);
  const p = s.world.projectiles.find((q) => !seen.has(q.id) && q.owner === u.owner);
  return p && { from: { x: p.x - p.vx, y: p.y - p.vy, z: p.z - (p.vz + GRAVITY) }, before };
}

/** Ticks until `u` fires, at most `max`; `max + 1` if it never does. */
function ticksToFire(s: SimState, u: Unit, max: number): number {
  for (let n = 1; n <= max; n++) if (stepShot(s, u)) return n;
  return max + 1;
}

for (const kind of ["tank", "artillery"] as const) {
  for (const mode of ["mobile", "sieged"] as const) {
    test(`${kind} ${mode}: a shell fired while the turret turns starts at the tip from before the tick`, () => {
      const { s, u, t } = duel(kind, mode);
      u.facing = 10;
      u.aim = 2;
      u.elevation = planned(s, u, t) + 25;
      const shot = stepShot(s, u);
      assert.ok(shot, "no shell");
      assert.equal(u.aim, 0, "the turret turned this tick");
      assert.notEqual(u.elevation, shot.before.elevation, "the elevation moved this tick");
      assert.deepEqual(shot.from, muzzleTip(shot.before.mount, s.world.terrain, shot.before.aim, shot.before.elevation));
    });

    test(`${kind} ${mode}: every shell starts at the tip from before its tick`, () => {
      const { s, u } = duel(kind, mode);
      let shots = 0;
      for (let n = 0; n < 60; n++) {
        const shot = stepShot(s, u);
        if (!shot) continue;
        shots++;
        assert.deepEqual(shot.from, muzzleTip(shot.before.mount, s.world.terrain, shot.before.aim, shot.before.elevation));
      }
      assert.ok(shots >= 2, `shots ${shots}`);
    });

    test(`${kind} ${mode}: a barrel off the bearing holds fire one tick, then fires`, () => {
      const { s, u, t } = duel(kind, mode);
      u.aim = 20;
      u.elevation = planned(s, u, t);
      assert.equal(stepShot(s, u), undefined);
      assert.ok(ticksToFire(s, u, 1) <= 1);
    });

    test(`${kind} ${mode}: a barrel off the elevation holds fire one tick, then fires`, () => {
      const { s, u, t } = duel(kind, mode);
      u.elevation = planned(s, u, t) + 100;
      assert.equal(stepShot(s, u), undefined);
      assert.ok(ticksToFire(s, u, 1) <= 1);
    });

    test(`${kind} ${mode}: the first shot on a target dead ahead comes within 2 ticks`, () => {
      const { s, u } = duel(kind, mode);
      assert.equal(u.facing, 0);
      assert.ok(ticksToFire(s, u, 2) <= 2);
    });
  }
}
