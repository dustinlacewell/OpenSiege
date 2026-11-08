import { muzzleX, muzzleZ, type Barrel } from "../game/muzzle.ts";
import { BARREL, BARREL_DARK, DARK, LEG, type MeshBuilder, TRACK, TURRET, TURRET_DARK } from "./meshBuilder.ts";

/** Sub-assemblies the unit models share. Model space: +x forward, z up from the ground. */

export interface TrackSpec {
  /** Centre line distance from the hull axis. */
  y: number;
  length: number;
  width: number;
  height: number;
  /** Road wheel x positions. */
  wheels: readonly number[];
}

/** Two track belts with road wheels on their outer faces. */
export function tracks(b: MeshBuilder, t: TrackSpec): void {
  const r = t.height * 0.36;
  const z = t.height / 2;
  for (const s of [-1, 1]) {
    const cy = t.y * s;
    b.track(0, cy, 0, t.length, t.width, t.height, TRACK);
    const face = cy + (t.width / 2) * s;
    for (const x of t.wheels) {
      b.cylinder([x, face, z], [x, face + 1.2 * s, z], r, 10, DARK);
      b.cylinder([x, face, z], [x, face + 2.2 * s, z], r * 0.4, 6, DARK);
    }
  }
}

/** A wheel and hub on one side, axis along y. */
export function wheel(b: MeshBuilder, x: number, y: number, radius: number, width: number): void {
  const s = Math.sign(y) || 1;
  b.cylinder([x, y - (width / 2) * s, radius], [x, y + (width / 2) * s, radius], radius, 16, TRACK);
  b.cylinder([x, y, radius], [x, y + (width / 2 + 0.8) * s, radius], radius * 0.45, 8, DARK);
}

/** The barrel tube, a thicker sleeve at the breech and a muzzle brake at the tip. `BARREL` parts: they pitch about the breech. */
export function barrel(b: MeshBuilder, spec: Barrel, sleeve: number): void {
  const c = Math.cos(spec.elevation), s = Math.sin(spec.elevation);
  const at = (d: number) => [spec.x + c * d, 0, spec.z + s * d] as const;
  const tip = [muzzleX(spec), 0, muzzleZ(spec)] as const;
  b.cylinder([spec.x, 0, spec.z], tip, spec.radius, 12, BARREL);
  b.cylinder([spec.x, 0, spec.z], at(spec.length * 0.3), spec.radius * sleeve, 12, BARREL);
  b.cylinder(at(spec.length - 6), tip, spec.radius * 1.45, 10, BARREL_DARK);
}

/** Four mirrored outriggers: a strut from the hull to a foot pad on the ground. */
export function legs(b: MeshBuilder, attach: readonly number[], foot: readonly number[], thick: number, pad: number): void {
  for (const sx of [-1, 1]) {
    for (const sy of [-1, 1]) {
      const fx = foot[0]! * sx, fy = foot[1]! * sy;
      b.beam([attach[0]! * sx, attach[1]! * sy, attach[2]!], [fx, fy, foot[2]! + 3], thick, LEG);
      b.bevelBox(fx, fy, 0, pad, pad, 4, 1, LEG);
    }
  }
}

/** A round turret hatch: a ring and a slightly raised lid. */
export function hatch(b: MeshBuilder, x: number, y: number, z: number, radius: number): void {
  b.cylinder([x, y, z], [x, y, z + 1.2], radius, 16, TURRET_DARK);
  b.cylinder([x, y, z + 1.2], [x, y, z + 2], radius * 0.8, 16, TURRET);
}
