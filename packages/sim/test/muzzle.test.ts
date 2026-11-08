import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnUnit, step, UNIT_STATS, type SimState, type Unit, type UnitKind } from "../src/index.ts";
import { muzzleTip } from "../src/muzzle.ts";
import { aim } from "../src/launch.ts";
import { GRAVITY, PROJ_FP } from "../src/stats.ts";
import type { Fp3 } from "../src/features/featureHit.ts";
import { freshState, TINY } from "./helpers.ts";

const GROUND = 500;

/** Flat open ground at GROUND. */
function flat(): SimState {
  return freshState(1, TINY, (spec) => {
    spec.heights.fill(GROUND);
    spec.features = [];
    spec.fields = [];
  });
}

/** Step until `u`'s first shell is out; its spawn point is one tick of flight back. */
function firstSpawn(s: SimState, u: Unit): Fp3 {
  for (let t = 0; t < 30 && s.world.projectiles.length === 0; t++) step(s, []);
  const p = s.world.projectiles[0];
  assert.ok(p && p.owner === u.owner, "no shell fired");
  return { x: p.x - p.vx, y: p.y - p.vy, z: p.z - (p.vz + GRAVITY) };
}

/** Each axis within `tol` fixed-point units. */
function near(a: Fp3, b: Fp3, tol: number): void {
  for (const k of ["x", "y", "z"] as const) assert.ok(Math.abs(a[k] - b[k]) <= tol, `${k}: ${a[k]} vs ${b[k]}`);
}

/** Slope in permille of the barrel that puts the tip at `from`, recovered from the tip's offset. */
function tipSlope(kind: UnitKind, u: Unit, from: Fp3): number {
  const s = UNIT_STATS[kind];
  const run = Math.hypot(from.x / PROJ_FP - u.x, from.y / PROJ_FP - u.y) - s.gunX;
  const rise = from.z / PROJ_FP - GROUND - s.gunZ + (u.mode === "sieged" ? s.sink : 0);
  return (rise * 1000) / run;
}

for (const kind of ["tank", "artillery"] as const) {
  test(`a ${kind} shell starts at the barrel tip`, () => {
    const s = flat();
    const u = spawnUnit(s.world, 0, kind, 300, 300);
    spawnUnit(s.world, 1, "harvester", 700, 700);
    let was = { aim: u.aim, elevation: u.elevation };
    for (let t = 0; t < 30 && s.world.projectiles.length === 0; t++) {
      was = { aim: u.aim, elevation: u.elevation };
      step(s, []);
    }
    const p = s.world.projectiles[0]!;
    assert.ok(p && p.owner === u.owner, "no shell fired");
    const from = { x: p.x - p.vx, y: p.y - p.vy, z: p.z - (p.vz + GRAVITY) };
    near(from, muzzleTip(u, s.world.terrain, was.aim, was.elevation), PROJ_FP);
  });
}

/** A `kind` at (300, 1000) facing +x, in `mode`. */
const mount = (kind: UnitKind, mode: Unit["mode"] = "mobile") => ({ kind, x: 300, y: 1000, facing: 0, mode });

test("muzzleTip: a flat barrel reaches gunX + gunLength forward at gunZ", () => {
  const t = UNIT_STATS.tank;
  assert.deepEqual(muzzleTip(mount("tank"), flat().world.terrain, 0, 0), {
    x: (300 + t.gunX + t.gunLength) * PROJ_FP, y: 1000 * PROJ_FP, z: (GROUND + t.gunZ) * PROJ_FP,
  });
});

test("muzzleTip: a sieged unit's tip is `sink` lower", () => {
  const terrain = flat().world.terrain;
  for (const kind of ["tank", "artillery"] as const) {
    const mobile = muzzleTip(mount(kind), terrain, 0, 300);
    const sieged = muzzleTip(mount(kind, "sieged"), terrain, 0, 300);
    assert.deepEqual(sieged, { ...mobile, z: mobile.z - UNIT_STATS[kind].sink * PROJ_FP });
  }
});

test("muzzleTip: a 1000 permille barrel splits its length evenly into rise and run", () => {
  const t = UNIT_STATS.tank;
  const tip = muzzleTip(mount("tank"), flat().world.terrain, 0, 1000);
  const half = t.gunLength * Math.SQRT1_2;
  near(tip, { x: (300 + t.gunX + half) * PROJ_FP, y: 1000 * PROJ_FP, z: (GROUND + t.gunZ + half) * PROJ_FP }, PROJ_FP);
});

test("muzzleTip: no barrel fires from the centre at 70% height", () => {
  const h = UNIT_STATS.harvester;
  assert.equal(h.gunLength, 0);
  assert.deepEqual(muzzleTip(mount("harvester"), flat().world.terrain, 40, 500), {
    x: 300 * PROJ_FP, y: 1000 * PROJ_FP, z: (GROUND + Math.floor((h.height * 70) / 100)) * PROJ_FP,
  });
});

for (const [kind, sieged, ranges] of [
  ["tank", false, [200, 400, 650]],
  ["artillery", false, [350, 450, 580]],
  ["artillery", true, [400, 1200, 2100]],
] as const) {
  test(`${kind}${sieged ? " sieged" : ""}: the arc's elevation matches the tip it leaves from`, () => {
    for (const d of ranges) {
      const s = flat();
      const u = spawnUnit(s.world, 0, kind, 100, 100);
      if (sieged) u.mode = "sieged";
      const t = spawnUnit(s.world, 1, "harvester", 100 + d, 100);
      const shot = aim(s.world, u, t);
      assert.ok(shot, `no shot at ${d}`);
      const e = tipSlope(kind, u, shot.from);
      assert.ok(Math.abs(e - shot.arc.elevation) <= 5, `range ${d}: tip ${e.toFixed(1)} vs arc ${shot.arc.elevation}`);
    }
  });
}

/** `kind` at (300, 1000) with harvesters at the given distances along +x; its target after one tick. */
function targetAt(kind: UnitKind, sieged: boolean, ...dists: number[]): number {
  const s = flat();
  const u = spawnUnit(s.world, 0, kind, 300, 1000);
  if (sieged) u.mode = "sieged";
  const foes = dists.map((d) => spawnUnit(s.world, 1, "harvester", 300 + d, 1000));
  step(s, []);
  return foes.findIndex((f) => f.id === u.target);
}

for (const sieged of [false, true]) {
  test(`artillery${sieged ? " sieged" : ""} will not target inside its min range`, () => {
    assert.equal(UNIT_STATS.artillery.minRange, 300);
    assert.equal(targetAt("artillery", sieged, 200), -1);
    assert.equal(targetAt("artillery", sieged, 400), 0);
    assert.equal(targetAt("artillery", sieged, 200, 450), 1);
  });
}

test("a tank, with no min range, targets a near enemy", () => {
  assert.equal(targetAt("tank", false, 200), 0);
  assert.equal(targetAt("tank", false, 200, 450), 0);
});
