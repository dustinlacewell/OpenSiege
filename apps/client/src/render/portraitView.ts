import { UNIT_STATS, type UnitKind } from "@mf/sim";
import { mat4, multiply, perspective, setVec3, vec3, viewFromBasis, type Mat4, type Vec3 } from "../game/mat4.ts";
import { SUN } from "./scene.ts";

/** The camera of one headshot, and the hull yaw that shows the unit three-quarters front. */
export interface PortraitView {
  readonly viewProj: Mat4;
  readonly eye: Vec3;
  /** Fog scales with this. It is far past the model, so fog never starts. */
  readonly dist: number;
  /** Hull yaw for the unit. The turret aims the same way. */
  readonly yaw: number;
}

const FOV_Y = (28 * Math.PI) / 180;
/** Radians above the horizon. */
const PITCH = 0.42;
/** The camera stands this far round from the sun, so the lit side shows with some shading. */
const FROM_SUN = 0.5;
/** The unit's front turns this far away from the camera: a three-quarter view. */
const FRONT_TURN = 0.65;
const NO_FOG = 1e7;

/** Frames a unit on its radius and height from UNIT_STATS. Model origin is on the ground under its centre. */
export function portraitView(kind: UnitKind): PortraitView {
  const s = UNIT_STATS[kind];
  const bearing = Math.atan2(SUN[1], SUN[0]) + FROM_SUN;
  const reach = Math.hypot(s.radius * 1.2, s.height * 0.6);
  const dist = reach / Math.sin(FOV_Y / 2);
  const { right, up, back } = basis(bearing);
  const eye = vec3(back[0]! * dist, back[1]! * dist, s.height * 0.4 + back[2]! * dist);
  const view = viewFromBasis(mat4(), eye, right, up, back);
  const proj = perspective(mat4(), FOV_Y, 1, Math.max(1, dist - 3 * reach), dist + 3 * reach);
  return { viewProj: multiply(mat4(), proj, view), eye, dist: NO_FOG, yaw: bearing - FRONT_TURN };
}

/** The same basis as the game camera (`camera.ts`), for an eye at `bearing` from the target. */
function basis(bearing: number): { right: Vec3; up: Vec3; back: Vec3 } {
  const yaw = bearing - Math.PI / 2;
  const c = Math.cos(PITCH);
  const s = Math.sin(PITCH);
  const rx = Math.cos(yaw), ry = Math.sin(yaw);
  const fx = ry, fy = -rx;
  return {
    right: setVec3(vec3(), rx, ry, 0),
    up: setVec3(vec3(), fx * s, fy * s, c),
    back: setVec3(vec3(), -fx * c, -fy * c, s),
  };
}
