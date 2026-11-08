import { UNIT_STATS, type UnitKind } from "@mf/sim";
import { hash01 } from "../game/hash01.ts";
import { blob } from "./meshBlob.ts";
import { BARREL, BARREL_DARK, DARK, DISH, HULL, LEG, LIGHT, MAST, MeshBuilder, PANEL, TRACK, TURRET, TURRET_DARK, TURRET_PANEL, VERTEX_FLOATS, type P3 } from "./meshBuilder.ts";
import { centroid, cross, normalize } from "./meshMath.ts";
import { UNIT_MESHES, type UnitMesh } from "./meshes.ts";
import { PART, type PropPart } from "./propMaterials.ts";
import type { WreckForm } from "./wreckForm.ts";

/** How one unit kind breaks. Lengths are fractions of the unit's sim radius (R) or height (H). */
export interface WreckStyle {
  /** Scrap lean, degrees. Wreckage leans a third of it. */
  tilt: number;
  /** Direction of the lean, radians from +x. */
  lean: number;
  /** How deep scrap sits in the ground, fraction of H. Wreckage sinks half as deep. */
  sink: number;
  /** Dent depth, fraction of R. Wreckage is dented twice as deep. */
  dent: number;
  /** Unit parts the scrap has lost. */
  scrapDrop: readonly number[];
  /** Unit parts the wreckage has lost. */
  wreckDrop: readonly number[];
  /** Unit parts broken short: pulled within `reach` R of the centre and `top` H of the ground. */
  cut: { parts: readonly number[]; reach: number; top: number };
  /** Height of the wreckage's rubble mound, in model units. */
  mound: number;
  /** Seeds the dents and the mound. */
  seed: number;
}

const NO_CUT = { parts: [], reach: 1, top: 1 };

/** One row per unit kind. A new unit is one row. */
export const WRECK_STYLE: Record<UnitKind, WreckStyle> = {
  factory: {
    tilt: 5, lean: 0.6, sink: 0.1, dent: 0.05, scrapDrop: [LEG, LIGHT], wreckDrop: [LEG, LIGHT, PANEL],
    cut: NO_CUT, mound: 0.55, seed: 11,
  },
  harvester: {
    tilt: 9, lean: 2.1, sink: 0.12, dent: 0.06, scrapDrop: [LEG, LIGHT], wreckDrop: [LEG, LIGHT, PANEL],
    cut: { parts: [DARK], reach: 1, top: 0.8 }, mound: 0.5, seed: 23,
  },
  engineer: {
    tilt: 11, lean: 4, sink: 0.15, dent: 0.07, scrapDrop: [LEG, LIGHT], wreckDrop: [LEG, LIGHT, PANEL, DARK],
    cut: { parts: [PANEL, DARK], reach: 0.9, top: 0.7 }, mound: 0.6, seed: 37,
  },
  radar: {
    tilt: 8, lean: 5.2, sink: 0.12, dent: 0.06, scrapDrop: [DISH, LIGHT, LEG], wreckDrop: [DISH, MAST, LIGHT, LEG],
    cut: { parts: [MAST], reach: 1, top: 0.8 }, mound: 0.5, seed: 41,
  },
  jammer: {
    tilt: 8, lean: 5.2, sink: 0.12, dent: 0.06, scrapDrop: [DISH, LIGHT, LEG], wreckDrop: [DISH, MAST, LIGHT, LEG],
    cut: { parts: [MAST], reach: 1, top: 0.8 }, mound: 0.5, seed: 47,
  },
  tank: {
    tilt: 7, lean: 1.2, sink: 0.12, dent: 0.06, scrapDrop: [LIGHT], wreckDrop: [TURRET_DARK, BARREL_DARK, TURRET_PANEL, LIGHT, LEG],
    cut: { parts: [TURRET, TURRET_DARK, BARREL, BARREL_DARK], reach: 0.8, top: 1 }, mound: 0.45, seed: 53,
  },
  artillery: {
    tilt: 6, lean: 3.3, sink: 0.1, dent: 0.05, scrapDrop: [LEG, LIGHT], wreckDrop: [TURRET, TURRET_DARK, BARREL, BARREL_DARK, TURRET_PANEL, LIGHT, LEG],
    cut: { parts: [TURRET, TURRET_DARK, BARREL, BARREL_DARK], reach: 0.75, top: 0.9 }, mound: 0.5, seed: 67,
  },
  mine: {
    tilt: 4, lean: 0.3, sink: 0.2, dent: 0.08, scrapDrop: [LIGHT, TURRET_DARK], wreckDrop: [TURRET, TURRET_DARK, LIGHT],
    cut: NO_CUT, mound: 0.6, seed: 79,
  },
};

/** What sets scrap and wreckage apart. */
interface FormShape {
  drop(s: WreckStyle): readonly number[];
  /** Multiply the style's tilt, sink and dent. */
  tilt: number;
  sink: number;
  dent: number;
  /** Prop material of each unit part. */
  material: Record<number, PropPart>;
  mound: boolean;
}

const SCRAP_MATERIAL: Record<number, PropPart> = {
  [HULL]: "scrapRust", [TURRET]: "scrapRust", [LEG]: "scrapScorched", [PANEL]: "scrapSteel", [TRACK]: "scrapScorched",
  [DARK]: "scrapScorched", [TURRET_PANEL]: "scrapSteel", [TURRET_DARK]: "scrapScorched", [LIGHT]: "scrapScorched",
  [MAST]: "scrapScorched", [DISH]: "scrapSteel", [BARREL]: "scrapRust", [BARREL_DARK]: "scrapScorched",
};

const CHARRED_MATERIAL: Record<number, PropPart> = {
  [HULL]: "ember", [TURRET]: "ember", [LEG]: "soot", [PANEL]: "ember", [TRACK]: "soot", [DARK]: "soot",
  [TURRET_PANEL]: "ember", [TURRET_DARK]: "soot", [LIGHT]: "soot", [MAST]: "soot", [DISH]: "ember",
  [BARREL]: "ember", [BARREL_DARK]: "soot",
};

const FORMS: Record<WreckForm, FormShape> = {
  scrap: { drop: (s) => s.scrapDrop, tilt: 1, sink: 1, dent: 1, material: SCRAP_MATERIAL, mound: false },
  wreckage: { drop: (s) => s.wreckDrop, tilt: 1 / 3, sink: 0.5, dent: 2, material: CHARRED_MATERIAL, mound: true },
};

/** The model is shrunk evenly until it fits this many R across and this many H up. */
const FIT_RADIUS = 1.15;
const FIT_HEIGHT = 1.05;

/** One triangle in unit-mesh space: corners, a normal that says which side is out, the unit part. */
interface Tri {
  p: P3[];
  n: P3;
  part: number;
}

/** The unit's sim footprint radius and height: the unit mesh is in these world units already. */
interface Size {
  r: number;
  h: number;
}

/**
 * A normalised prop model (1 R wide, 1 H tall) of what unit `unit` leaves as `form`, built from its own mesh.
 * Pure and deterministic: no randomness, no GL.
 */
export function wreckModel(unit: UnitKind, form: WreckForm): Float32Array {
  const style = WRECK_STYLE[unit];
  const shape = FORMS[form];
  const mesh = UNIT_MESHES[unit]();
  const size: Size = { r: UNIT_STATS[unit].radius, h: UNIT_STATS[unit].height };
  const drop = shape.drop(style);
  const kept = triangles(mesh.vertices).filter((t) => !drop.includes(t.part));
  const broken = kept.map((t) => breakTri(t, mesh, style, shape, size));
  const b = new MeshBuilder();
  for (const t of normalise(broken, size)) emit(b, t, shape.material);
  if (shape.mound) rubble(b, style);
  return b.build();
}

function triangles(v: Float32Array): Tri[] {
  const out: Tri[] = [];
  const at = (i: number): P3 => [v[i]!, v[i + 1]!, v[i + 2]!];
  for (let i = 0; i < v.length; i += VERTEX_FLOATS * 3) {
    const j = i + VERTEX_FLOATS, k = i + VERTEX_FLOATS * 2;
    const n = normalize([v[i + 3]! + v[j + 3]! + v[k + 3]!, v[i + 4]! + v[j + 4]! + v[k + 4]!, v[i + 5]! + v[j + 5]! + v[k + 5]!]);
    out.push({ p: [at(i), at(j), at(k)], n, part: v[i + 6]! });
  }
  return out;
}

/** Poses the triangle as a mobile unit, then breaks it: cut short, dented, tilted, sunk. */
function breakTri(t: Tri, mesh: UnitMesh, style: WreckStyle, shape: FormShape, size: Size): Tri {
  const tilt = (style.tilt * shape.tilt * Math.PI) / 180;
  const sink = style.sink * shape.sink * size.h;
  const dent = style.dent * shape.dent * size.r;
  const place = (p: P3): P3 => {
    const q = dented(cutShort(pose(p, t.part, mesh), t.part, style, size), p, dent, style.seed);
    const r = lean(q, style.lean, tilt);
    return [r[0], r[1], r[2] - sink];
  };
  return { p: t.p.map(place), n: lean(poseNormal(t.n, t.part, mesh), style.lean, tilt), part: t.part };
}

/** As the unit shader draws it with siege 0: legs drawn in and lifted, mast and dish folded. */
function pose(p: P3, part: number, mesh: UnitMesh): P3 {
  if (part === LEG) return [p[0] * 0.6, p[1] * 0.6, p[2] + mesh.legLift];
  if ((part === MAST || part === DISH) && mesh.mast) {
    const { x, z, fold } = mesh.mast;
    const [dx, dz] = rot(p[0] - x, p[2] - z, fold);
    return [x + dx, p[1], z + dz];
  }
  return p;
}

function poseNormal(n: P3, part: number, mesh: UnitMesh): P3 {
  if ((part === MAST || part === DISH) && mesh.mast) {
    const [nx, nz] = rot(n[0], n[2], mesh.mast.fold);
    return [nx, n[1], nz];
  }
  return n;
}

function cutShort(p: P3, part: number, style: WreckStyle, size: Size): P3 {
  if (!style.cut.parts.includes(part)) return p;
  const reach = style.cut.reach * size.r;
  const r = Math.hypot(p[0], p[1]);
  const k = r > reach ? reach / r : 1;
  return [p[0] * k, p[1] * k, Math.min(p[2], style.cut.top * size.h)];
}

/** Moves a corner by noise of its original spot, so shared corners move together: no cracks. Dents push down. */
function dented(p: P3, orig: P3, depth: number, seed: number): P3 {
  const qx = Math.round(orig[0] * 8), qy = Math.round(orig[1] * 8), qz = Math.round(orig[2] * 8);
  const h = (axis: number) => hash01(qx + (seed * 4 + axis) * 8192, qy, qz);
  return [p[0] + (2 * h(0) - 1) * depth, p[1] + (2 * h(1) - 1) * depth, p[2] - h(2) * depth];
}

/** Turns `p` by `angle` about the ground axis square to direction `dir`, so the top leans toward `dir`. */
function lean(p: P3, dir: number, angle: number): P3 {
  const ax = -Math.sin(dir), ay = Math.cos(dir);
  const c = Math.cos(angle), s = Math.sin(angle);
  const dot = ax * p[0] + ay * p[1];
  const cr: P3 = [ay * p[2], -ax * p[2], ax * p[1] - ay * p[0]];
  return [
    p[0] * c + cr[0] * s + ax * dot * (1 - c),
    p[1] * c + cr[1] * s + ay * dot * (1 - c),
    p[2] * c + cr[2] * s,
  ];
}

function rot(x: number, y: number, a: number): [number, number] {
  const c = Math.cos(a), s = Math.sin(a);
  return [c * x - s * y, s * x + c * y];
}

/**
 * To model units: x and y by R, z by H, after an even shrink that fits FIT_RADIUS and FIT_HEIGHT.
 * Normals take the inverse stretch. Triangles crushed to nothing by a cut are dropped.
 */
function normalise(tris: readonly Tri[], size: Size): Tri[] {
  let reach = 0, top = 0;
  for (const t of tris) for (const p of t.p) {
    reach = Math.max(reach, Math.hypot(p[0], p[1]));
    top = Math.max(top, p[2]);
  }
  const s = Math.min(1, (FIT_RADIUS * size.r) / (reach || 1), (FIT_HEIGHT * size.h) / (top || 1));
  const kx = s / size.r, kz = s / size.h;
  return tris
    .map((t) => ({
      p: t.p.map((p): P3 => [p[0] * kx, p[1] * kx, p[2] * kz]),
      n: normalize([t.n[0] * size.r, t.n[1] * size.r, t.n[2] * size.h]),
      part: t.part,
    }))
    .filter((t) => area(t.p) > 1e-7);
}

function area([a, b, c]: P3[]): number {
  const n = cross([b![0] - a![0], b![1] - a![1], b![2] - a![2]], [c![0] - a![0], c![1] - a![1], c![2] - a![2]]);
  return Math.hypot(n[0], n[1], n[2]) / 2;
}

/** A flat face whose normal agrees with the triangle's out side. */
function emit(b: MeshBuilder, t: Tri, material: Record<number, PropPart>): void {
  const c = centroid(t.p);
  b.face(t.p, [c[0] - t.n[0], c[1] - t.n[1], c[2] - t.n[2]], PART[material[t.part]!]);
}

/** The wreckage's low heap of soot under the hull. */
function rubble(b: MeshBuilder, style: WreckStyle): void {
  blob(b, { at: [0, 0, 0], radii: [0.8, 0.7, style.mound], jitter: 0.35, seed: style.seed, level: 1, part: PART.soot, cut: -0.15 });
}
