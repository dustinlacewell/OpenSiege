import assert from "node:assert/strict";
import { test } from "node:test";
import { UNIT_STATS } from "@mf/sim";
import { GUIDE_RING_SCALE, guideRings, pulse, UNIT_PULSE_PERIOD, type GuidePose, type GuideRing } from "../src/game/guideMarks.ts";

test("pulse stays in 0..1", () => {
  for (let t = 0; t < 5; t += 0.037) {
    const v = pulse(t, UNIT_PULSE_PERIOD);
    assert.ok(v >= 0 && v <= 1, `pulse(${t}) = ${v}`);
  }
});

test("pulse is 0 at each period start, 1 at mid-period, and repeats", () => {
  const p = UNIT_PULSE_PERIOD;
  assert.ok(Math.abs(pulse(0, p)) < 1e-9);
  assert.ok(Math.abs(pulse(p / 2, p) - 1) < 1e-9);
  assert.ok(Math.abs(pulse(p, p)) < 1e-9);
  assert.ok(Math.abs(pulse(0.3, p) - pulse(0.3 + 3 * p, p)) < 1e-9);
});

test("guideRings skips ids with no pose and sizes rings by kind", () => {
  const poses = new Map<number, GuidePose>([
    [1, { x: 10, y: 20, z: 5, unit: { kind: "tank" } }],
    [3, { x: 30, y: 40, z: 6, unit: { kind: "tank" } }],
  ]);
  const out: GuideRing[] = [];
  const n = guideRings([1, 2, 3], (id) => poses.get(id), out);
  assert.equal(n, 2);
  assert.deepEqual(out[0], { x: 10, y: 20, z: 5, radius: UNIT_STATS.tank.radius * GUIDE_RING_SCALE });
  assert.equal(out[1]!.x, 30);
});

test("guideRings reuses ring objects across calls", () => {
  const pose: GuidePose = { x: 1, y: 2, z: 3, unit: { kind: "tank" } };
  const out: GuideRing[] = [];
  guideRings([7], () => pose, out);
  const first = out[0];
  assert.equal(guideRings([7], () => pose, out), 1);
  assert.equal(out[0], first);
  assert.equal(guideRings([], () => pose, out), 0);
});
