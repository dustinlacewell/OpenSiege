import { test } from "node:test";
import assert from "node:assert/strict";
import type { Unit } from "@mf/sim";
import { centerOn, createCamera, rotate, updateMatrices } from "../src/game/camera.ts";
import { groundBoxCorners, unitsInGroundBox, type GroundBox } from "../src/game/groundBox.ts";
import { project, type ScreenPoint } from "../src/game/picking.ts";
import type { Vision } from "../src/game/vision.ts";

const vision = { shows: (u: Unit) => u.id !== 99 } as unknown as Vision;
const all = () => true;
const unit = (id: number, x: number, y: number) => ({ id, x, y }) as Unit;

test("a ground box holds the units whose ground position is inside it, whatever the corner order", () => {
  const units = [unit(1, 150, 150), unit(2, 100, 100), unit(3, 301, 150), unit(4, 150, 99), unit(99, 150, 150)];
  const box: GroundBox = { ax: 100, ay: 100, bx: 300, by: 200, yaw: 0 };
  assert.deepEqual(unitsInGroundBox(units, vision, box, all), [1, 2]);
  const flipped: GroundBox = { ax: 300, ay: 200, bx: 100, by: 100, yaw: 0 };
  assert.deepEqual(unitsInGroundBox(units, vision, flipped, all), [1, 2]);
});

test("a ground box turns with its yaw", () => {
  const yaw = Math.PI / 4;
  // Right is (r, r) and the perpendicular is (-r, r). B sits 100 along each from A at the origin.
  const r = Math.SQRT1_2;
  const box: GroundBox = { ax: 0, ay: 0, bx: 0, by: 200 * r, yaw };
  const inside = unit(1, 0, 100 * r);
  const beyondRight = unit(2, 150 * r, 150 * r);
  const insideAxisBox = unit(3, 60, 10);
  assert.deepEqual(unitsInGroundBox([inside, beyondRight, insideAxisBox], vision, box, all), [1]);
});

test("a ground box keeps only accepted units", () => {
  const units = [unit(1, 10, 10), unit(2, 20, 20)];
  const box: GroundBox = { ax: 0, ay: 0, bx: 50, by: 50, yaw: 0 };
  assert.deepEqual(unitsInGroundBox(units, vision, box, (u) => u.id === 2), [2]);
});

test("the box's right-hand side is horizontal on screen at any camera yaw", () => {
  for (const yaw of [0, 0.6, 2.5]) {
    const cam = createCamera(1000, 800);
    cam.map = { width: 6000, height: 6000 };
    centerOn(cam, 3000, 3000);
    rotate(cam, yaw);
    updateMatrices(cam);
    const c = groundBoxCorners({ ax: 2800, ay: 2900, bx: 3300, by: 3200, yaw: cam.yaw });
    const a: ScreenPoint = { x: 0, y: 0 }, b: ScreenPoint = { x: 0, y: 0 };
    assert.ok(project(cam, c[0]!, c[1]!, 0, a) && project(cam, c[2]!, c[3]!, 0, b));
    assert.ok(Math.abs(a.y - b.y) < 1e-3, `yaw ${yaw}: ${a.y} vs ${b.y}`);
  }
});
