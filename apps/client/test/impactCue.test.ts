import { test } from "node:test";
import assert from "node:assert/strict";
import { PROJ_FP, UNIT_STATS, type World } from "@mf/sim";
import type { SoundEvent } from "../src/audio/cues.ts";
import { diffWorld, impactCue, type Marks, type UnitMark } from "../src/audio/worldEvents.ts";
import type { ShotState } from "../src/game/shotTracker.ts";

const TANK_REACH = UNIT_STATS.tank.radius + 8;

test("no unit near the burst: ground", () => {
  assert.equal(impactCue("artillery", 500, 500, []), "shellGround");
  assert.equal(impactCue("artillery", 500, 500, [{ kind: "tank", x: 500 + TANK_REACH + 1, y: 500 }]), "shellGround");
});

test("a unit centre within its hit radius + 8: armor", () => {
  assert.equal(impactCue("artillery", 500, 500, [{ kind: "tank", x: 500 + TANK_REACH, y: 500 }]), "shellArmor");
  assert.equal(impactCue("tank", 500, 500, [{ kind: "tank", x: 500, y: 500 - TANK_REACH + 1 }]), "roundArmor");
});

test("the firer's weapon picks shell or round", () => {
  assert.equal(UNIT_STATS.artillery.weapon, "ballistic");
  assert.equal(UNIT_STATS.tank.weapon, "direct");
  assert.equal(impactCue("artillery", 0, 0, []), "shellGround");
  assert.equal(impactCue("tank", 0, 0, []), "roundGround");
});

function shot(source: ShotState["source"], x: number, y: number): ShotState {
  return { source, x: x * PROJ_FP, y: y * PROJ_FP, z: 0, vx: 0, vy: 0, vz: 0, splash: 90, gen: 0 };
}

const emptyWorld = { units: [], players: [] } as unknown as World;

test("a unit destroyed this step at the burst: armor", () => {
  const before: Marks = {
    units: new Map<number, UnitMark>([[7, { kind: "tank", owner: 2, hp: 10, mode: "mobile", x: 300, y: 300, jobProgress: -1 }]]),
    credits: 0,
  };
  const out: SoundEvent[] = [];
  diffWorld(before, emptyWorld, 1, 1, [shot("tank", 305, 300)], out);
  assert.equal(out.find((e) => e.cue === "roundArmor")?.x, 305);
  assert.ok(out.some((e) => e.cue === "destroyed"));
});

test("a burst far from every unit in the diff: ground, sized by splash", () => {
  const out: SoundEvent[] = [];
  diffWorld({ units: new Map(), credits: 0 }, emptyWorld, 1, 1, [shot("artillery", 50, 50)], out);
  assert.deepEqual(out, [{ cue: "shellGround", x: 50, y: 50, spatial: true, own: false, size: 0.5 }]);
});
