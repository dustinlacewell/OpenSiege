import { blob } from "./meshBlob.ts";
import { MeshBuilder } from "./meshBuilder.ts";
import { PART, type PropPart } from "./propMaterials.ts";

/**
 * Tree models, 1 tall. The trunk is about 0.3 wide; the crown spreads to 1.5 or so, so a tree's
 * `radius` (what blocks) is the trunk's reach and the leaves overhang it.
 */

/** [foot z, tip z, radius, material] of one cone of needles. */
type Tier = readonly [number, number, number, PropPart];

function trunk(b: MeshBuilder, top: number, radius: number, lean = 0): void {
  b.cylinder([0, 0, -0.03], [lean, 0, top], radius, 6, PART.bark);
}

function needles(b: MeshBuilder, tiers: readonly Tier[], segs: number): void {
  for (const [z0, z1, r, part] of tiers) b.cone([0, 0, z0], [0, 0, z1], r, 0, segs, PART[part]);
}

/** Stacked cones, broad and dark. */
export function spruce(): Float32Array {
  const b = new MeshBuilder();
  trunk(b, 0.3, 0.26);
  needles(b, [
    [0.12, 0.5, 1.5, "needleDark"], [0.32, 0.72, 1.18, "needle"],
    [0.52, 0.9, 0.85, "needleDark"], [0.7, 1, 0.5, "needle"],
  ], 8);
  return b.build();
}

/** Five narrow tiers on a long trunk. */
export function pine(): Float32Array {
  const b = new MeshBuilder();
  trunk(b, 0.5, 0.22);
  needles(b, [
    [0.18, 0.4, 1, "needle"], [0.32, 0.56, 0.85, "needleDark"], [0.46, 0.7, 0.7, "needle"],
    [0.6, 0.85, 0.52, "needleDark"], [0.74, 1, 0.34, "needle"],
  ], 7);
  return b.build();
}

/** A leafy crown of three lumps on a leaning trunk. */
export function oak(): Float32Array {
  const b = new MeshBuilder();
  trunk(b, 0.5, 0.3, 0.06);
  blob(b, { at: [0, 0, 0.62], radii: [1.5, 1.4, 0.38], jitter: 0.18, seed: 11, level: 1, part: PART.leaf });
  blob(b, { at: [0.7, 0.35, 0.52], radii: [0.85, 0.8, 0.3], jitter: 0.2, seed: 12, level: 0, part: PART.leafLight });
  blob(b, { at: [-0.55, -0.4, 0.7], radii: [0.8, 0.8, 0.3], jitter: 0.2, seed: 13, level: 0, part: PART.leaf });
  return b.build();
}

/** Short and wide, in warmer leaves. */
export function broadleaf(): Float32Array {
  const b = new MeshBuilder();
  trunk(b, 0.4, 0.34);
  blob(b, { at: [0, 0, 0.55], radii: [1.7, 1.6, 0.3], jitter: 0.15, seed: 14, level: 0, part: PART.leafWarm });
  blob(b, { at: [0.2, -0.1, 0.78], radii: [1.1, 1, 0.24], jitter: 0.2, seed: 15, level: 0, part: PART.leafLight });
  return b.build();
}
