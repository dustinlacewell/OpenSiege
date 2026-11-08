import assert from "node:assert/strict";
import { test } from "node:test";
import { centerOn, createCamera, pan, setCameraMap } from "../src/game/camera.ts";

test("setCameraMap centres a non-square map", () => {
  const cam = createCamera(800, 600);
  setCameraMap(cam, { width: 24000, height: 8000 });
  assert.equal(cam.x, 12000);
  assert.equal(cam.y, 4000);
});

test("camera clamps each axis to its own side", () => {
  const cam = createCamera(800, 600);
  setCameraMap(cam, { width: 24000, height: 8000 });
  centerOn(cam, 30000, 20000);
  assert.deepEqual([cam.x, cam.y], [24000, 8000]);
  centerOn(cam, -5, -5);
  assert.deepEqual([cam.x, cam.y], [0, 0]);
  centerOn(cam, 20000, 4000);
  assert.deepEqual([cam.x, cam.y], [20000, 4000]);
});

test("panning stays on the map", () => {
  const cam = createCamera(800, 600);
  setCameraMap(cam, { width: 4000, height: 12000 });
  pan(cam, -1e6, -1e6);
  assert.ok(cam.x >= 0 && cam.x <= 4000 && cam.y >= 0 && cam.y <= 12000);
});

test("a camera with no map is pinned at the origin", () => {
  const cam = createCamera(800, 600);
  centerOn(cam, 500, 500);
  assert.deepEqual([cam.x, cam.y], [0, 0]);
});
