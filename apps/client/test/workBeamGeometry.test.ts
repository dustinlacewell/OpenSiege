import { test } from "node:test";
import assert from "node:assert/strict";
import { UNIT_STATS, type Feature, type Terrain, type Unit } from "@mf/sim";
import type { PoseTable, UnitPose } from "../src/game/poses.ts";
import { ENGINEER_EMITTER } from "../src/render/meshSupport.ts";
import { workBeams as fillBeams, type WorkBeam } from "../src/render/workBeamGeometry.ts";

const N = 9;
const FLAT: Terrain = { cols: N, rows: N, cell: 50, heights: new Array<number>(N * N).fill(20), seaLevel: 0 };

function workBeams(poses: PoseTable, features: Feature[] = []): WorkBeam[] {
  const out: WorkBeam[] = [];
  return out.slice(0, fillBeams(poses, features, FLAT, out));
}

function scrap(id: number, x: number, y: number): Feature {
  return { id, kind: "scrap", x, y, radius: 30, hp: 100, variant: 0, unit: "tank" };
}

function pose(id: number, kind: string, work: number, x: number, y: number, z: number, yaw = 0): UnitPose {
  const unit = { id, kind, work } as unknown as Unit;
  return { unit, x, y, z, yaw, aim: 0, pitch: 0, roll: 0, siege: 0 };
}

function table(...poses: UnitPose[]): PoseTable {
  return { poses, count: poses.length };
}

test("a working engineer beams from its mast light to its target's middle", () => {
  const target = pose(2, "tank", 0, 300, 100, 20);
  const [beam, ...rest] = workBeams(table(pose(1, "engineer", 2, 100, 50, 10, Math.PI / 2), target));
  assert.equal(rest.length, 0);
  assert.ok(Math.abs(beam!.ax - 100) < 1e-9);
  assert.ok(Math.abs(beam!.ay - (50 + ENGINEER_EMITTER.x)) < 1e-9);
  assert.equal(beam!.az, 10 + ENGINEER_EMITTER.z);
  assert.deepEqual([beam!.bx, beam!.by, beam!.bz], [300, 100, 20 + UNIT_STATS.tank.height * 0.5]);
});

test("beam objects are reused across frames", () => {
  const out: WorkBeam[] = [];
  const poses = table(pose(1, "engineer", 2, 0, 0, 0), pose(2, "tank", 0, 50, 0, 0));
  fillBeams(poses, [], FLAT, out);
  const first = out[0];
  assert.equal(fillBeams(poses, [], FLAT, out), 1);
  assert.equal(out[0], first);
  assert.equal(out.length, 1);
});

test("an idle engineer, or one whose target is neither posed nor a feature, has no beam", () => {
  assert.equal(workBeams(table(pose(1, "engineer", 0, 0, 0, 0), pose(2, "tank", 0, 9, 9, 0))).length, 0);
  assert.equal(workBeams(table(pose(1, "engineer", 7, 0, 0, 0)), [scrap(8, 50, 50)]).length, 0);
});

test("an engineer reclaiming scrap beams to the scrap's centre, low over the ground", () => {
  const [beam, ...rest] = workBeams(table(pose(1, "engineer", 7, 100, 100, 20)), [scrap(5, 0, 0), scrap(7, 200, 150)]);
  assert.equal(rest.length, 0);
  assert.equal(beam!.bx, 200);
  assert.equal(beam!.by, 150);
  assert.ok(beam!.bz > 20 && beam!.bz < 20 + UNIT_STATS.tank.height * 0.5, `bz ${beam!.bz}`);
});

test("a posed unit wins over a feature for the same work id", () => {
  const [beam] = workBeams(table(pose(1, "engineer", 2, 0, 0, 0), pose(2, "tank", 0, 50, 0, 0)), [scrap(2, 300, 300)]);
  assert.equal(beam!.bx, 50);
});
