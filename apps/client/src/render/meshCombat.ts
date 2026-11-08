import { barrelOf, type Barrel } from "../game/muzzle.ts";
import { BARREL_DARK, DARK, HULL, LIGHT, MeshBuilder, PANEL, TURRET, TURRET_DARK, TURRET_PANEL } from "./meshBuilder.ts";
import type { UnitMesh } from "./meshes.ts";
import { barrel, hatch, legs, tracks } from "./meshParts.ts";

/** Tracked hull with fenders and an engine deck, a turret with hatch and antenna, a straight barrel. */
export function tank(): UnitMesh {
  const b = new MeshBuilder();
  tracks(b, { y: 20, length: 78, width: 14, height: 17, wheels: [-26, -13, 0, 13, 26] });
  b.wedge(2, 0, 10, 74, 40, 16, 8, HULL);
  for (const s of [-1, 1]) {
    b.bevelBox(0, 23.5 * s, 17, 80, 7, 2, 0.6, HULL);
    b.box(39.3, 13 * s, 13.5, 1.6, 4, 2.5, LIGHT);
    b.cylinder([-34, 12 * s, 22], [-39, 12 * s, 22], 2, 8, DARK);
    b.box(-3, 11.9 * s, 29.5, 18, 1.2, 4.5, TURRET_PANEL);
  }
  b.bevelBox(-24, 0, 24, 22, 32, 3, 1, DARK);
  for (const x of [-31, -27, -23, -19]) b.box(x, 0, 26.6, 1.5, 26, 0.8, DARK);
  b.box(-24, 0, 24.5, 4, 38, 0.6, PANEL);
  b.cylinder([-2, 0, 25], [-2, 0, 27], 15, 20, TURRET_DARK);
  b.taperedBox(-2, 0, 26, 32, 26, 11, 24, 20, TURRET);
  b.bevelBox(14, 0, 29, 8, 12, 8, 1.5, TURRET);
  hatch(b, -8, 5, 37, 4.5);
  b.bevelBox(2, -6, 37, 5, 4, 2.5, 0.6, TURRET_DARK);
  b.cylinder([-14, -8, 37], [-14, -8, 64], 0.5, 6, TURRET_DARK);
  const gun = barrelOf("tank")!;
  barrel(b, gun, 1.3);
  legs(b, [26, 20, 10], [38, 32, 0], 3, 8);
  return { vertices: b.build(), legLift: 8, base: [0.45, 0.48, 0.38], gun: { x: gun.x, z: gun.z } };
}

/** Tracked hull with a front cab, low turret with ammo racks, long barrel raised high over recoil cylinders. */
export function artillery(): UnitMesh {
  const b = new MeshBuilder();
  const spec = barrelOf("artillery")!;
  tracks(b, { y: 24, length: 86, width: 15, height: 17, wheels: [-30, -15, 0, 15, 30] });
  b.bevelBox(0, 0, 11, 82, 40, 17, 2.5, HULL);
  b.wedge(30, 0, 28, 20, 30, 8, 3, HULL);
  for (const s of [-1, 1]) {
    b.bevelBox(0, 28 * s, 17, 86, 8, 2, 0.6, HULL);
    b.box(0, 20.2 * s, 18, 40, 0.8, 6, PANEL);
    b.box(41.2, 14 * s, 18, 1.6, 4, 2.5, LIGHT);
    b.box(-6, 15.3 * s, 32, 16, 1, 5, TURRET_PANEL);
    recoilCylinder(b, spec, 4.5 * s);
  }
  b.box(-43, 0, 2, 4, 30, 14, DARK);
  b.cylinder([-4, 0, 27], [-4, 0, 29], 18, 20, TURRET_DARK);
  b.taperedBox(-4, 0, 28, 34, 32, 14, 28, 28, TURRET);
  b.bevelBox(-24, 0, 30, 10, 24, 9, 1, TURRET);
  hatch(b, -10, -8, 42, 4);
  barrel(b, spec, 1.6);
  legs(b, [32, 22, 14], [56, 48, 0], 4, 12);
  return { vertices: b.build(), legLift: 16, base: [0.47, 0.47, 0.4], gun: { x: spec.x, z: spec.z } };
}

/** Under the barrel and pitches with it. */
function recoilCylinder(b: MeshBuilder, spec: Barrel, y: number): void {
  const c = Math.cos(spec.elevation), s = Math.sin(spec.elevation);
  const len = spec.length * 0.35;
  const x0 = spec.x, z0 = spec.z - 3;
  b.cylinder([x0, y, z0], [x0 + c * len, y, z0 + s * len], 1.6, 8, BARREL_DARK);
}

/** Low tracked disc with a domed top, a ring of spikes and a blinking light. The landmine: sieged, it digs in until only the light shows. */
export function mine(): UnitMesh {
  const b = new MeshBuilder();
  tracks(b, { y: 16, length: 36, width: 9, height: 11, wheels: [-10, 0, 10] });
  b.cylinder([0, 0, 6], [0, 0, 16], 20, 16, HULL);
  b.cylinder([0, 0, 16], [0, 0, 22], 15, 16, TURRET);
  b.cylinder([0, 0, 22], [0, 0, 25], 9, 12, TURRET_DARK);
  for (let i = 0; i < 6; i++) {
    const a = (i * Math.PI) / 3;
    const c = Math.cos(a), s = Math.sin(a);
    b.cone([c * 17, s * 17, 12], [c * 28, s * 28, 14], 3, 0.6, 6, DARK);
  }
  b.box(0, 0, 25, 4, 4, 3, LIGHT);
  return { vertices: b.build(), legLift: 0, base: [0.5, 0.42, 0.3] };
}
