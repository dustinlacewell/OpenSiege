import { UNIT_STATS } from "@mf/sim";
import type { UnitPose } from "../../src/game/poses.ts";

// A TypeScript replica of UNIT_VS (`src/render/unitShader.ts`) for one barrel vertex.
// HAND-COPIED FROM THE SHADER: when UNIT_VS changes how it places a barrel vertex, change this too.

type V3 = { x: number; y: number; z: number };

function rot(a: number, b: number, angle: number): [number, number] {
  const c = Math.cos(angle), s = Math.sin(angle);
  return [c * a - s * b, s * a + c * b];
}

/**
 * World position of barrel vertex `v` (model space, as built) of a unit drawn at `p`, with the barrel
 * pivot `gun` (x, z): barrel pitch and swing about the pivot, siege sink, turret turn, tilt (roll then pitch), yaw, translate.
 */
export function barrelVertex(v: V3, p: UnitPose, gun: { x: number; z: number }): V3 {
  let { x, y, z } = v;
  [x, z] = rot(x - gun.x, z - gun.z, p.gun);
  z += gun.z;
  [x, y] = rot(x, y, p.swing);
  x += gun.x;
  z -= UNIT_STATS[p.unit.kind].sink * p.siege;
  [x, y] = rot(x, y, p.aim - p.yaw);
  [y, z] = rot(y, z, p.roll);
  [x, z] = rot(x, z, p.pitch);
  [x, y] = rot(x, y, p.yaw);
  return { x: x + p.x, y: y + p.y, z: z + p.z };
}
