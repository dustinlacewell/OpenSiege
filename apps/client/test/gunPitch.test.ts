import { test } from "node:test";
import assert from "node:assert/strict";
import { GUN_MAX, GUN_MIN, gunPose, SWING_MAX, type HullAttitude } from "../src/game/gunPitch.ts";

const DEG = Math.PI / 180;
const near = (a: number, b: number, eps = 1e-9) => assert.ok(Math.abs(a - b) <= eps, `${a} vs ${b}`);
const hull = (yaw: number, pitch = 0, roll = 0): HullAttitude => ({ yaw, pitch, roll });
const gunOf = (permille: number, rest: number, aim: number, h: HullAttitude) => gunPose(permille, rest, aim, h).gun;

function rot(a: number, b: number, angle: number): [number, number] {
  const c = Math.cos(angle), s = Math.sin(angle);
  return [c * a - s * b, s * a + c * b];
}

/** The unit shader's barrel direction: rest, pitch, swing plus turret turn, tilt (roll then pitch), yaw. */
function drawnDirection(rest: number, aim: number, h: HullAttitude, permille: number): [number, number, number] {
  const g = gunPose(permille, rest, aim, h);
  let x = Math.cos(rest), y = 0, z = Math.sin(rest);
  [x, z] = rot(x, z, g.gun);
  [x, y] = rot(x, y, g.swing + aim - h.yaw);
  [y, z] = rot(y, z, h.roll);
  [x, z] = rot(x, z, h.pitch);
  [x, y] = rot(x, y, h.yaw);
  return [x, y, z];
}

test("flat hull and level shot: barrel level, no swing", () => {
  assert.deepEqual(gunPose(0, 0, 0, hull(0)), { gun: 0, swing: 0 });
});

test("364 permille is about 20 degrees on a flat hull", () => {
  near(gunOf(364, 0, 1, hull(1)) / DEG, 20, 0.01);
});

test("on a flat hull the barrel never swings, whatever the turret turn", () => {
  for (const [aim, yaw] of [[1, 1], [2.5, -0.4], [3.1, -3.1], [-3.1, 3.1]] as const) near(gunPose(700, 0, aim, hull(yaw)).swing, 0, 1e-9);
});

test("hull pitched up toward the target cancels the same world elevation", () => {
  const e = Math.tan(10 * DEG) * 1000;
  near(gunOf(e, 0, 0.7, hull(0.7, 10 * DEG)), 0, 1e-9);
});

test("turret turned 90 degrees reads hull roll, not pitch", () => {
  near(gunOf(0, 0, Math.PI / 2, hull(0, 15 * DEG, 8 * DEG)), -8 * DEG, 1e-9);
});

test("on a tilted hull the drawn barrel points exactly along the world aim", () => {
  const cases: [number, number, HullAttitude, number][] = [
    [0, Math.PI / 2, hull(0, 15 * DEG), 700],
    [35 * DEG, 2, hull(0.5, -12 * DEG, 9 * DEG), 1500],
    [0, -1, hull(2, 7 * DEG, -14 * DEG), 150],
  ];
  for (const [rest, aim, h, permille] of cases) {
    const e = Math.atan(permille / 1000);
    const [x, y, z] = drawnDirection(rest, aim, h, permille);
    near(x, Math.cos(e) * Math.cos(aim), 1e-9);
    near(y, Math.cos(e) * Math.sin(aim), 1e-9);
    near(z, Math.sin(e), 1e-9);
  }
});

test("a barrel modelled at its rest elevation does not move when shooting at that elevation", () => {
  const rest = 35 * DEG;
  near(gunOf(Math.tan(rest) * 1000, rest, 0.3, hull(0.3)), 0, 1e-9);
  near(gunOf(Math.tan(60 * DEG) * 1000, rest, 0, hull(0)), 25 * DEG, 1e-9);
  near(gunOf(0, rest, 0, hull(0)), -rest, 1e-9);
});

test("clamped in the turret frame, then measured from rest", () => {
  const rest = 35 * DEG;
  assert.equal(gunOf(100000, 0, 0, hull(0)), GUN_MAX);
  assert.equal(gunOf(-100000, 0, 0, hull(0)), GUN_MIN);
  near(gunOf(100000, rest, 0, hull(0)), GUN_MAX - rest);
  near(gunOf(-100000, rest, 0, hull(0)), GUN_MIN - rest);
  near(GUN_MAX, 85 * DEG);
  near(GUN_MIN, -30 * DEG);
});

test("a near-vertical shot across a tilted hull clamps its swing", () => {
  assert.equal(gunPose(100000, 0, Math.PI / 2, hull(0, 15 * DEG)).swing, -SWING_MAX);
  near(SWING_MAX, 45 * DEG);
});
