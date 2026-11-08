import assert from "node:assert/strict";
import { test } from "node:test";
import type { World } from "@mf/sim";
import { centerOn, createCamera, setCameraMap } from "../src/game/camera.ts";
import { GuideCamera, lookPoint } from "../src/game/guideCamera.ts";
import { arrowSegs, GESTURE_PERIOD, gestureAt, gestureSlots, gestureTaken, type GestureState, type Seg } from "../src/game/guideMarks.ts";
import type { GuideView } from "../src/game/tutorial/types.ts";

const world = { units: [{ id: 7, x: 1000, y: 1000 }] } as unknown as World;
const view = (index: number, over: Partial<GuideView> = {}): GuideView => ({
  prompt: "", index, count: 3, note: false, controls: [], units: [7], zones: [], gesture: null, follow: [], ...over,
});

function cam() {
  const c = createCamera(800, 600);
  setCameraMap(c, { width: 7000, height: 4000 });
  centerOn(c, 3000, 2000);
  return c;
}

test("lookPoint: focused units first, else zones, else gesture ends; null with none", () => {
  const zone = { name: "z", x: 3000, y: 1000, radius: 1 };
  assert.deepEqual(lookPoint(view(0, { zones: [zone] }), world), { x: 1000, y: 1000 });
  assert.deepEqual(lookPoint(view(0, { units: [], zones: [zone] }), world), { x: 3000, y: 1000 });
  assert.deepEqual(lookPoint(view(0, { units: [], gesture: { shape: "line", from: { x: 0, y: 0 }, to: { x: 0, y: 200 } } }), world), { x: 0, y: 100 });
  assert.equal(lookPoint(view(0, { units: [99] }), world), null);
  assert.deepEqual(lookPoint(view(0, { units: [99], zones: [zone] }), world), { x: 3000, y: 1000 });
});

test("guide camera: a new step glides the camera to its focus", () => {
  const c = cam(), g = new GuideCamera();
  for (let i = 0; i < 120; i++) g.update(view(0), world, c, 1 / 60);
  assert.ok(Math.hypot(c.x - 1000, c.y - 1000) < 20, `camera at ${c.x}, ${c.y}`);
});

test("guide camera: the player panning ends the glide; the same step never glides again", () => {
  const c = cam(), g = new GuideCamera();
  g.update(view(0), world, c, 1 / 60);
  centerOn(c, 5000, 3000);
  for (let i = 0; i < 120; i++) g.update(view(0), world, c, 1 / 60);
  assert.deepEqual([c.x, c.y], [5000, 3000]);
});

test("guide camera: a follow tracks the units as they move, past the first arrival", () => {
  const c = cam(), g = new GuideCamera(), unit = { id: 8, x: 2000, y: 2000 };
  const moving = { units: [unit] } as unknown as World;
  const v = view(0, { units: [], follow: [8] });
  for (let i = 0; i < 120; i++) g.update(v, moving, c, 1 / 60);
  unit.x = 2500;
  for (let i = 0; i < 120; i++) g.update(v, moving, c, 1 / 60);
  assert.ok(Math.hypot(c.x - 2500, c.y - 2000) < 20, `camera at ${c.x}, ${c.y}`);
});

test("guide camera: a pan stops a follow; a follow that starts after a pan takes the camera again", () => {
  const c = cam(), g = new GuideCamera(), unit = { id: 8, x: 2000, y: 2000 };
  const moving = { units: [unit] } as unknown as World;
  g.update(view(0, { units: [] }), moving, c, 1 / 60);
  centerOn(c, 5000, 3000);
  g.update(view(0, { units: [] }), moving, c, 1 / 60);
  for (let i = 0; i < 120; i++) g.update(view(0, { units: [], follow: [8] }), moving, c, 1 / 60);
  assert.ok(Math.hypot(c.x - 2000, c.y - 2000) < 20, `camera at ${c.x}, ${c.y}`);
  centerOn(c, 5000, 3000);
  for (let i = 0; i < 120; i++) g.update(view(0, { units: [], follow: [8] }), moving, c, 1 / 60);
  assert.deepEqual([c.x, c.y], [5000, 3000]);
});

test("gestureTaken: the player's own drag of the same shape, pressed near the shown one", () => {
  const line = { shape: "line" as const, from: { x: 0, y: 0 }, to: { x: 0, y: 400 } };
  const circle = { shape: "circle" as const, from: { x: 1000, y: 0 }, to: { x: 1200, y: 0 } };
  assert.equal(gestureTaken(line, null), false);
  assert.equal(gestureTaken(line, { shape: "line", x: 0, y: 0 }), true);
  assert.equal(gestureTaken(line, { shape: "line", x: 300, y: 200 }), true);
  assert.equal(gestureTaken(line, { shape: "line", x: 2000, y: 200 }), false);
  assert.equal(gestureTaken(line, { shape: "circle", x: 0, y: 0 }), false);
  assert.equal(gestureTaken(circle, { shape: "circle", x: 1100, y: 0 }), true);
  assert.equal(gestureTaken(circle, { shape: "circle", x: 3000, y: 0 }), false);
});

test("arrow: three segments meeting at a tip above the point, which bobs", () => {
  const out: Seg[] = [];
  arrowSegs(10, 20, 100, 1, 0, 1000, 0, out);
  assert.equal(out.length, 3);
  const tip0 = out[0]!.az;
  for (const s of out) assert.deepEqual([s.ax, s.ay, s.az], [10, 20, tip0]);
  assert.ok(tip0 > 100);
  arrowSegs(10, 20, 100, 1, 0, 1000, 0.45, out);
  assert.ok(out[0]!.az > tip0, "the arrow does not bob");
});

test("gesture: starts at `from`, ends at `to` with the line done, then loops", () => {
  const g = { shape: "line" as const, from: { x: 0, y: 0 }, to: { x: 0, y: 100 } };
  const s: GestureState = { x: 0, y: 0, t: 0, alpha: 1, done: false };
  assert.deepEqual({ ...gestureAt(g, 0, s) }, { x: 0, y: 0, t: 0, alpha: 1, done: false });
  gestureAt(g, 1.8, s);
  assert.deepEqual([s.y, s.done], [100, true]);
  assert.ok(gestureAt(g, GESTURE_PERIOD - 0.05, s).alpha < 0.2);
  assert.equal(gestureAt(g, GESTURE_PERIOD, s).t, 0);
  assert.deepEqual(gestureSlots(g, 3), [{ x: 0, y: 0 }, { x: 0, y: 50 }, { x: 0, y: 100 }]);
});
