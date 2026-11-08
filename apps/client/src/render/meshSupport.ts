import { DARK, DISH, HULL, LIGHT, MAST, MeshBuilder, PANEL } from "./meshBuilder.ts";
import type { UnitMesh } from "./meshes.ts";
import { legs, tracks, wheel } from "./meshParts.ts";

/** Tracked chassis, sloped cab, an open assembly bay under roof trusses, a crane with beacons. */
export function factory(): UnitMesh {
  const b = new MeshBuilder();
  tracks(b, { y: 50, length: 172, width: 26, height: 26, wheels: [-66, -44, -22, 0, 22, 44, 66] });
  b.bevelBox(0, 0, 20, 160, 96, 28, 4, HULL);
  b.wedge(58, 0, 48, 40, 86, 40, 26, HULL);
  b.box(78.6, 0, 60, 1, 60, 10, DARK);
  b.box(-25, 0, 48, 116, 76, 1, DARK);
  for (const s of [-1, 1]) {
    b.box(58, 43.5 * s, 56, 28, 2, 14, PANEL);
    b.bevelBox(-25, 42 * s, 48, 120, 8, 70, 2, HULL);
    b.box(-25, 46.5 * s, 92, 110, 1.5, 10, PANEL);
    b.cylinder([44, 38 * s, 88], [44, 38 * s, 91], 2.5, 8, LIGHT);
  }
  for (const x of [-80, -25, 30]) b.box(x, 0, 112, 8, 92, 6, HULL);
  for (const y of [-30, -10, 10, 30]) b.box(-80, y, 30, 4, 12, 10, DARK);
  b.cylinder([-70, -30, 118], [-70, -30, 152], 5, 12, DARK);
  b.beam([-70, -30, 149], [22, -30, 149], 6, HULL);
  b.beam([12, -30, 149], [12, -30, 96], 1.5, DARK);
  b.bevelBox(12, -30, 88, 8, 8, 7, 1, DARK);
  b.cylinder([22, -30, 153], [22, -30, 156], 2.5, 8, LIGHT);
  legs(b, [70, 46, 34], [95, 78, 0], 7, 22);
  return { vertices: b.build(), legLift: 26, base: [0.52, 0.53, 0.5] };
}

/** Wide tracked hull with a framed hopper, a small cab, exhaust stack and a ribbed drum drill on a scoop. */
export function harvester(): UnitMesh {
  const b = new MeshBuilder();
  tracks(b, { y: 36, length: 86, width: 18, height: 19, wheels: [-30, -15, 0, 15, 30] });
  b.bevelBox(-4, 0, 14, 82, 56, 20, 3, HULL);
  b.taperedBox(-20, 0, 34, 46, 58, 32, 54, 66, HULL);
  for (const s of [-1, 1]) {
    b.box(-20, 31.2 * s, 46, 34, 1.5, 12, PANEL);
    b.box(-20, 33 * s, 66, 54, 2.5, 3, DARK);
    b.box(-20 + 26 * s, 0, 66, 2.5, 66, 3, DARK);
  }
  b.wedge(22, -14, 34, 26, 24, 24, 16, HULL);
  b.box(35.4, -14, 44, 0.8, 18, 5, DARK);
  for (const y of [-22, -6]) b.box(35.6, y, 37, 1.4, 3, 2, LIGHT);
  b.cylinder([18, -14, 58], [18, -14, 61], 2, 8, LIGHT);
  b.cylinder([-40, 22, 34], [-40, 22, 72], 2.5, 10, DARK);
  b.wedge(46, 0, 4, 22, 72, 22, 6, HULL);
  b.cylinder([52, -34, 15], [52, 34, 15], 9, 16, DARK);
  for (const y of [-24, -8, 8, 24]) b.cylinder([52, y - 1, 15], [52, y + 1, 15], 11, 12, HULL);
  legs(b, [30, 30, 20], [50, 52, 0], 5, 12);
  return { vertices: b.build(), legLift: 14, base: [0.66, 0.58, 0.3] };
}

/** Where the engineer's work beam leaves: the light on top of its mast, in unit space. */
export const ENGINEER_EMITTER = { x: -12, z: 65 };

/** Small four-wheeled body with an equipment deck, an antenna mast, dish and beacon. */
export function engineer(): UnitMesh {
  const b = new MeshBuilder();
  for (const x of [-14, 14]) for (const y of [-16, 16]) wheel(b, x, y, 7, 6);
  b.bevelBox(0, 0, 6, 44, 26, 16, 2.5, HULL);
  b.wedge(8, 0, 22, 18, 22, 12, 7, HULL);
  for (const s of [-1, 1]) {
    b.box(-6, 13.2 * s, 10, 24, 1, 8, PANEL);
    b.box(22.2, 9 * s, 12, 1.4, 3, 2, LIGHT);
  }
  b.bevelBox(-12, 0, 22, 14, 18, 5, 1, DARK);
  b.cylinder([-12, 0, 27], [-12, 0, 62], 1.6, 8, DARK);
  b.box(-12, 0, 58, 4, 18, 2.5, PANEL);
  b.cylinder([-12, 0, 62], [ENGINEER_EMITTER.x, 0, ENGINEER_EMITTER.z], 2.4, 10, LIGHT);
  legs(b, [16, 12, 10], [26, 24, 0], 3, 7);
  return { vertices: b.build(), legLift: 8, base: [0.58, 0.6, 0.55] };
}

/** Radar hinge on the rear bed: the mast stands 22 up from it, the dish faces back. */
const RADAR_HINGE = { x: -24, z: 24 };
const RADAR_MAST = 22;

/**
 * Six-wheeled truck: a sloped cab, a flat bed, and a radar mast hinged at the rear. Modelled raised;
 * when mobile the mast lies forward along the bed with the dish flat on top (`mast` fold).
 */
export function radar(): UnitMesh {
  const b = new MeshBuilder();
  for (const x of [-22, -6, 20]) for (const y of [-15, 15]) wheel(b, x, y, 8, 6);
  b.bevelBox(0, 0, 8, 64, 24, 8, 2, HULL);
  b.wedge(22, 0, 16, 20, 26, 20, 13, HULL);
  b.box(-11, 0, 16, 44, 28, 5, HULL);
  for (const s of [-1, 1]) {
    b.box(22, 13.2 * s, 26, 12, 1, 6, DARK);
    b.box(-11, 14.2 * s, 17, 40, 1, 3, PANEL);
    b.box(32.4, 9 * s, 18, 1.4, 3, 2, LIGHT);
    b.box(-2, 8 * s, 21, 3, 3, 5, DARK);
  }
  b.box(32.2, 0, 17, 1, 14, 6, DARK);
  b.cylinder([13, 0, 35], [13, 0, 38], 2.2, 10, LIGHT);
  radarMast(b);
  legs(b, [22, 12, 10], [28, 22, 0], 3, 7);
  return { vertices: b.build(), legLift: 8, base: [0.5, 0.56, 0.6], mast: { ...RADAR_HINGE, fold: -Math.PI / 2 } };
}

/** The radar truck's model in a violet paint. */
export function jammer(): UnitMesh {
  return { ...radar(), base: [0.44, 0.32, 0.5] };
}

/** Hinge block, mast, and a round dish with a feed horn, all in the raised pose. */
function radarMast(b: MeshBuilder): void {
  const { x, z } = RADAR_HINGE;
  const top = z + RADAR_MAST;
  b.bevelBox(x, 0, z - 3, 10, 12, 5, 1, DARK);
  b.cylinder([x, 0, z], [x, 0, top], 2, 8, MAST);
  b.cylinder([x - 2, 0, top], [x, 0, top], 3, 8, DISH);
  b.cylinder([x - 4, 0, top], [x - 2, 0, top], 14, 16, DISH);
  b.cylinder([x - 5, 0, top], [x - 4, 0, top], 9, 16, DISH);
  b.beam([x - 5, 0, top], [x - 10, 0, top], 1.4, DISH);
  b.cylinder([x - 10, 0, top], [x - 12, 0, top], 2.4, 8, DISH);
}
