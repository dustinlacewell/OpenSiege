import { test } from "node:test";
import assert from "node:assert/strict";
import { muzzleTip, PROJ_FP, UNIT_STATS, type Terrain, type UnitKind } from "@mf/sim";
import type { PrevPose } from "../src/game/interp.ts";
import { barrelOf, flashPoint, muzzleX, muzzleZ, restElevation } from "../src/game/muzzle.ts";

const GROUND = 55;
/** Flat ground at GROUND, 2000 world units across. */
const TERRAIN: Terrain = { cols: 101, rows: 101, cell: 20, heights: new Array(101 * 101).fill(GROUND), seaLevel: 0 };

const near = (a: number, b: number, eps = 1e-9) => assert.ok(Math.abs(a - b) <= eps, `${a} vs ${b}`);
const GUNS: UnitKind[] = ["tank", "artillery"];

test("a barrel comes from the sim's gun stats, and only kinds with a gun have one", () => {
  for (const kind of Object.keys(UNIT_STATS) as UnitKind[]) {
    const s = UNIT_STATS[kind];
    const b = barrelOf(kind);
    if (s.gunLength <= 0) {
      assert.equal(b, undefined, kind);
      continue;
    }
    assert.ok(b, kind);
    assert.deepEqual([b.x, b.z, b.length], [s.gunX, s.gunZ, s.gunLength]);
    near(b.elevation, restElevation(kind));
    near(b.elevation, (s.gunRest * Math.PI) / 180);
  }
});

test("the flash is at the sim's barrel tip for a tank and an artillery at several elevations", () => {
  for (const kind of GUNS) {
    for (const elevation of [0, 250, 700, 1428, 4000]) {
      const u = { kind, x: 1200, y: 800, facing: 20, mode: "mobile" as const, aim: 37, elevation };
      const tip = muzzleTip(u, TERRAIN, u.aim, elevation);
      const f = flashPoint(u, undefined, TERRAIN);
      near(f.x, tip.x / PROJ_FP);
      near(f.y, tip.y / PROJ_FP);
      near(f.z, tip.z / PROJ_FP);
    }
  }
});

/** The sim's tip for `kind` at `pose`, in world units. */
function tipAt(kind: UnitKind, pose: PrevPose): { x: number; y: number; z: number } {
  const t = muzzleTip({ kind, x: pose.x, y: pose.y, facing: pose.facing, mode: "mobile" }, TERRAIN, pose.aim, pose.elevation);
  return { x: t.x / PROJ_FP, y: t.y / PROJ_FP, z: t.z / PROJ_FP };
}

test("a moving unit's flash is at the pre-move tip, where the shell left, not the current one", () => {
  for (const kind of GUNS) {
    const prev: PrevPose = { x: 1000, y: 800, facing: 20, aim: 37, elevation: 250 };
    const u = { kind, mode: "mobile" as const, x: 1030, y: 812, facing: 20, aim: 37, elevation: 250 };
    const f = flashPoint(u, prev, TERRAIN);
    assert.deepEqual(f, tipAt(kind, prev), kind);
    const now = tipAt(kind, u);
    near(now.x - f.x, 30, 1e-6);
    near(now.y - f.y, 12, 1e-6);
  }
});

test("a turning unit's flash is at the pre-turn aim, facing and elevation", () => {
  for (const kind of GUNS) {
    const prev: PrevPose = { x: 1000, y: 800, facing: 20, aim: 37, elevation: 250 };
    const u = { kind, mode: "mobile" as const, x: 1000, y: 800, facing: 28, aim: 49, elevation: 700 };
    const f = flashPoint(u, prev, TERRAIN);
    assert.deepEqual(f, tipAt(kind, prev), kind);
    assert.notDeepEqual(f, tipAt(kind, u), kind);
  }
});

test("at rest elevation the flash sits on the modelled muzzle", () => {
  for (const kind of GUNS) {
    const b = barrelOf(kind)!;
    const slope = Math.round(Math.tan(b.elevation) * 1000);
    const f = flashPoint({ kind, x: 100, y: 100, facing: 0, mode: "mobile", aim: 0, elevation: slope }, undefined, TERRAIN);
    near(f.x, 100 + muzzleX(b), 0.1);
    near(f.y, 100, 0.1);
    near(f.z, GROUND + muzzleZ(b), 0.1);
  }
});
