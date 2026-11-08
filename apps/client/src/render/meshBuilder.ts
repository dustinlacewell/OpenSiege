import { basis, centroid, faceNormal, mid, normalize, type P3 } from "./meshMath.ts";

export type { P3 } from "./meshMath.ts";

/** Part flags, read by the unit shaders: how a vertex moves and what it is made of. */
export const HULL = 0;
export const TURRET = 1;
export const LEG = 2;
export const PANEL = 3;
export const TRACK = 4;
export const DARK = 5;
export const TURRET_PANEL = 6;
export const TURRET_DARK = 7;
export const LIGHT = 8;
/** Raised by siege: folds about the mesh's `mast` hinge when mobile. Dark material. */
export const MAST = 9;
/** Like MAST, and sweeps about the vertical axis through the hinge while sieged. Light paint. */
export const DISH = 10;
/** Like TURRET and TURRET_DARK, and pitches about the mesh's `gun` pivot. */
export const BARREL = 11;
export const BARREL_DARK = 12;

/** Floats per vertex: position (3), normal (3), part (1). */
export const VERTEX_FLOATS = 7;

/**
 * Low-poly solids as a triangle list. Flat faces point away from their solid's centre, so the builder
 * needs no winding convention; round surfaces carry smooth normals.
 */
export class MeshBuilder {
  private readonly data: number[] = [];

  /** Axis-aligned box from bottom z0, centred on (cx, cy). */
  box(cx: number, cy: number, z0: number, sx: number, sy: number, sz: number, part: number): this {
    return this.taperedBox(cx, cy, z0, sx, sy, sz, sx, sy, part);
  }

  /** Box whose top face is (tx, ty) while the bottom is (sx, sy). Top shifted forward by `lean`. */
  taperedBox(
    cx: number, cy: number, z0: number, sx: number, sy: number, sz: number, tx: number, ty: number,
    part: number, lean = 0,
  ): this {
    const b = corners(cx, cy, z0, sx / 2, sy / 2);
    const t = corners(cx + lean, cy, z0 + sz, tx / 2, ty / 2);
    return this.hexahedron(b, t, part);
  }

  /** Box with the front (+x) half of its top lowered to `frontZ`: a sloped nose. */
  wedge(cx: number, cy: number, z0: number, sx: number, sy: number, sz: number, frontZ: number, part: number): this {
    const b = corners(cx, cy, z0, sx / 2, sy / 2);
    const t = corners(cx, cy, z0 + sz, sx / 2, sy / 2);
    const top: P3[] = [t[0]!, [t[1]![0], t[1]![1], z0 + frontZ], [t[2]![0], t[2]![1], z0 + frontZ], t[3]!];
    return this.hexahedron(b, top, part);
  }

  /** Box with every edge chamfered by `bevel`: 6 faces, 12 edge strips, 8 corner triangles. */
  bevelBox(cx: number, cy: number, z0: number, sx: number, sy: number, sz: number, bevel: number, part: number): this {
    const h = [sx / 2, sy / 2, sz / 2];
    const b = Math.min(bevel, h[0]! * 0.9, h[1]! * 0.9, h[2]! * 0.9);
    const c: P3 = [cx, cy, z0 + sz / 2];
    /** Corner (i, j, k) as it sits on the face normal to `axis`. */
    const pt = (axis: number, i: number, j: number, k: number): P3 => {
      const s = [i, j, k];
      const at = (a: number) => c[a]! + s[a]! * (a === axis ? h[a]! : h[a]! - b);
      return [at(0), at(1), at(2)];
    };
    for (const s of [-1, 1]) {
      this.face([pt(0, s, -1, -1), pt(0, s, 1, -1), pt(0, s, 1, 1), pt(0, s, -1, 1)], c, part);
      this.face([pt(1, -1, s, -1), pt(1, 1, s, -1), pt(1, 1, s, 1), pt(1, -1, s, 1)], c, part);
      this.face([pt(2, -1, -1, s), pt(2, 1, -1, s), pt(2, 1, 1, s), pt(2, -1, 1, s)], c, part);
    }
    for (const i of [-1, 1]) {
      for (const j of [-1, 1]) {
        this.face([pt(0, i, j, -1), pt(1, i, j, -1), pt(1, i, j, 1), pt(0, i, j, 1)], c, part);
        this.face([pt(0, i, -1, j), pt(2, i, -1, j), pt(2, i, 1, j), pt(0, i, 1, j)], c, part);
        this.face([pt(1, -1, i, j), pt(2, -1, i, j), pt(2, 1, i, j), pt(1, 1, i, j)], c, part);
        for (const k of [-1, 1]) this.face([pt(0, i, j, k), pt(1, i, j, k), pt(2, i, j, k)], c, part);
      }
    }
    return this;
  }

  /** Round bar along `from → to` with `segs` sides, smooth-shaded, flat caps. */
  cylinder(from: P3, to: P3, radius: number, segs: number, part: number): this {
    const [u, v] = basis(from, to);
    const dirs: P3[] = Array.from({ length: segs }, (_, i) => {
      const a = (i / segs) * Math.PI * 2 + Math.PI / segs;
      const cu = Math.cos(a), sv = Math.sin(a);
      return [u[0] * cu + v[0] * sv, u[1] * cu + v[1] * sv, u[2] * cu + v[2] * sv];
    });
    const ring = (c: P3) => dirs.map((d) => [c[0] + d[0] * radius, c[1] + d[1] * radius, c[2] + d[2] * radius] as P3);
    const a = ring(from);
    const b = ring(to);
    for (let i = 0; i < segs; i++) {
      const j = (i + 1) % segs;
      this.smoothQuad([a[i]!, a[j]!, b[j]!, b[i]!], [dirs[i]!, dirs[j]!, dirs[j]!, dirs[i]!], part);
    }
    const center = mid(from, to);
    this.face(a, center, part);
    this.face(b, center, part);
    return this;
  }

  /** Cone or frustum: radius `r0` at `from`, `r1` at `to` (0 = a point). Smooth sides, flat caps. */
  cone(from: P3, to: P3, r0: number, r1: number, segs: number, part: number): this {
    const [u, v] = basis(from, to);
    const len = Math.hypot(to[0] - from[0], to[1] - from[1], to[2] - from[2]) || 1;
    const axis: P3 = [(to[0] - from[0]) / len, (to[1] - from[1]) / len, (to[2] - from[2]) / len];
    const dirs: P3[] = Array.from({ length: segs }, (_, i) => {
      const a = (i / segs) * Math.PI * 2 + Math.PI / segs;
      const cu = Math.cos(a), sv = Math.sin(a);
      return [u[0] * cu + v[0] * sv, u[1] * cu + v[1] * sv, u[2] * cu + v[2] * sv];
    });
    /** The side normal leans along the axis by how fast the radius shrinks. */
    const normals = dirs.map((d) => normalize([d[0] * len + axis[0] * (r0 - r1), d[1] * len + axis[1] * (r0 - r1), d[2] * len + axis[2] * (r0 - r1)]));
    const ring = (c: P3, r: number) => dirs.map((d) => [c[0] + d[0] * r, c[1] + d[1] * r, c[2] + d[2] * r] as P3);
    const a = ring(from, r0);
    const b = ring(to, r1);
    for (let i = 0; i < segs; i++) {
      const j = (i + 1) % segs;
      if (r1 > 0) {
        this.smoothQuad([a[i]!, a[j]!, b[j]!, b[i]!], [normals[i]!, normals[j]!, normals[j]!, normals[i]!], part);
      } else {
        const tipN = normalize([normals[i]![0] + normals[j]![0], normals[i]![1] + normals[j]![1], normals[i]![2] + normals[j]![2]]);
        this.vertex(a[i]!, normals[i]!, part);
        this.vertex(a[j]!, normals[j]!, part);
        this.vertex(to, tipN, part);
      }
    }
    this.face(a, to, part);
    if (r1 > 0) this.face(b, from, part);
    return this;
  }

  /** Slim square bar between two points, flat-shaded. */
  beam(from: P3, to: P3, thickness: number, part: number): this {
    const [u, v] = basis(from, to);
    const r = thickness * 0.7;
    const ring = (c: P3) =>
      [0, 1, 2, 3].map((i) => {
        const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
        const cu = Math.cos(a) * r, sv = Math.sin(a) * r;
        return [c[0] + u[0] * cu + v[0] * sv, c[1] + u[1] * cu + v[1] * sv, c[2] + u[2] * cu + v[2] * sv] as P3;
      });
    const a = ring(from);
    const b = ring(to);
    return this.hexahedron(a, b, part);
  }

  /** A track belt: a stadium profile (rounded front and back) `length` along x, extruded `width` along y. */
  track(cx: number, cy: number, z0: number, length: number, width: number, height: number, part: number, segs = 8): this {
    const r = height / 2;
    const zc = z0 + r;
    const half = Math.max(0, length / 2 - r);
    const profile: { x: number; z: number; nx: number; nz: number }[] = [];
    for (const [ox, start] of [[half, -Math.PI / 2], [-half, Math.PI / 2]] as const) {
      for (let k = 0; k <= segs; k++) {
        const a = start + (Math.PI * k) / segs;
        profile.push({ x: cx + ox + Math.cos(a) * r, z: zc + Math.sin(a) * r, nx: Math.cos(a), nz: Math.sin(a) });
      }
    }
    const y0 = cy - width / 2, y1 = cy + width / 2;
    const at = (i: number, y: number): P3 => [profile[i]!.x, y, profile[i]!.z];
    const n = (i: number): P3 => [profile[i]!.nx, 0, profile[i]!.nz];
    for (let i = 0; i < profile.length; i++) {
      const j = (i + 1) % profile.length;
      this.smoothQuad([at(i, y0), at(j, y0), at(j, y1), at(i, y1)], [n(i), n(j), n(j), n(i)], part);
    }
    const center: P3 = [cx, cy, zc];
    this.face(profile.map((_, i) => at(i, y0)), center, part);
    this.face(profile.map((_, i) => at(i, y1)), center, part);
    return this;
  }

  build(): Float32Array {
    return new Float32Array(this.data);
  }

  /** Eight corners: bottom four then top four, both in the same order around. */
  private hexahedron(b: readonly P3[], t: readonly P3[], part: number): this {
    const center = mid(centroid(b), centroid(t));
    this.face(b, center, part);
    this.face(t, center, part);
    for (let i = 0; i < 4; i++) {
      const j = (i + 1) % 4;
      this.face([b[i]!, b[j]!, t[j]!, t[i]!], center, part);
    }
    return this;
  }

  /** A planar convex polygon, fanned into triangles, normal facing away from `center`. */
  face(pts: readonly P3[], center: P3, part: number): void {
    const n = faceNormal(pts, center);
    for (let i = 1; i + 1 < pts.length; i++) {
      this.vertex(pts[0]!, n, part);
      this.vertex(pts[i]!, n, part);
      this.vertex(pts[i + 1]!, n, part);
    }
  }

  private smoothQuad(pts: readonly P3[], normals: readonly P3[], part: number): void {
    for (const k of [0, 1, 2, 0, 2, 3]) this.vertex(pts[k]!, normals[k]!, part);
  }

  private vertex(p: P3, n: P3, part: number): void {
    this.data.push(p[0], p[1], p[2], n[0], n[1], n[2], part);
  }
}

function corners(cx: number, cy: number, z: number, hx: number, hy: number): P3[] {
  return [[cx - hx, cy - hy, z], [cx + hx, cy - hy, z], [cx + hx, cy + hy, z], [cx - hx, cy + hy, z]];
}
