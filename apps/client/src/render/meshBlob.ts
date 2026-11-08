import { hash01 } from "../game/hash01.ts";
import type { MeshBuilder, P3 } from "./meshBuilder.ts";
import { normalize } from "./meshMath.ts";

/** An uneven, flat-faced lump: a jittered icosphere, stretched to an ellipsoid. For rocks, leaves and bushes. */
export interface BlobSpec {
  at: P3;
  /** Radii along x, y and z. */
  radii: P3;
  /** Radial noise, 0 = a smooth ball. 0.3 is a craggy rock. */
  jitter: number;
  /** Two blobs with different seeds have different lumps. */
  seed: number;
  /** 0 = 20 faces, 1 = 80 faces. */
  level: 0 | 1;
  part: number;
  /** Flattens the foot at this fraction of the z radius from the centre (−1 = the full ball). */
  cut?: number;
}

const T = (1 + Math.sqrt(5)) / 2;
const ICO_RAW: P3[] = [
  [-1, T, 0], [1, T, 0], [-1, -T, 0], [1, -T, 0], [0, -1, T], [0, 1, T],
  [0, -1, -T], [0, 1, -T], [T, 0, -1], [T, 0, 1], [-T, 0, -1], [-T, 0, 1],
];
const ICO_VERTS: P3[] = ICO_RAW.map(normalize);
const ICO_FACES: readonly (readonly [number, number, number])[] = [
  [0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8],
  [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1],
];

export function blob(b: MeshBuilder, spec: BlobSpec): void {
  const place = (p: P3): P3 => shape(p, spec);
  for (const [i, j, k] of ICO_FACES) {
    const tri: [P3, P3, P3] = [ICO_VERTS[i]!, ICO_VERTS[j]!, ICO_VERTS[k]!];
    for (const t of spec.level === 0 ? [tri] : split(tri)) b.face(t.map(place), spec.at, spec.part);
  }
}

/** Four triangles on the sphere from one. */
function split([a, b, c]: [P3, P3, P3]): [P3, P3, P3][] {
  const ab = normalize(add(a, b)), bc = normalize(add(b, c)), ca = normalize(add(c, a));
  return [[a, ab, ca], [b, bc, ab], [c, ca, bc], [ab, bc, ca]];
}

/** A unit-sphere point to its place on the lump. The noise depends on the point alone, so shared corners agree. */
function shape(p: P3, s: BlobSpec): P3 {
  const k = 1 + s.jitter * (2 * hash01(s.seed + Math.round(p[0] * 997), Math.round(p[1] * 997), Math.round(p[2] * 997)) - 1);
  const z = s.at[2] + p[2] * k * s.radii[2];
  const floor = s.cut === undefined ? -Infinity : s.at[2] + s.cut * s.radii[2];
  return [s.at[0] + p[0] * k * s.radii[0], s.at[1] + p[1] * k * s.radii[1], Math.max(z, floor)];
}

function add(a: P3, b: P3): P3 {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}
