/** Small vector helpers for building meshes. Allocating; build-time only. */

export type P3 = readonly [number, number, number];

/** Newell's method, flipped to point away from `center`. */
export function faceNormal(pts: readonly P3[], center: P3): P3 {
  let nx = 0, ny = 0, nz = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i]!, b = pts[(i + 1) % pts.length]!;
    nx += (a[1] - b[1]) * (a[2] + b[2]);
    ny += (a[2] - b[2]) * (a[0] + b[0]);
    nz += (a[0] - b[0]) * (a[1] + b[1]);
  }
  const len = Math.hypot(nx, ny, nz) || 1;
  const c = centroid(pts);
  const out = (c[0] - center[0]) * nx + (c[1] - center[1]) * ny + (c[2] - center[2]) * nz;
  const s = (out < 0 ? -1 : 1) / len;
  return [nx * s, ny * s, nz * s];
}

export function centroid(pts: readonly P3[]): P3 {
  let x = 0, y = 0, z = 0;
  for (const p of pts) {
    x += p[0];
    y += p[1];
    z += p[2];
  }
  return [x / pts.length, y / pts.length, z / pts.length];
}

export function mid(a: P3, b: P3): P3 {
  return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
}

/** Two unit vectors perpendicular to the axis and to each other. */
export function basis(from: P3, to: P3): [P3, P3] {
  const ax = to[0] - from[0], ay = to[1] - from[1], az = to[2] - from[2];
  const len = Math.hypot(ax, ay, az) || 1;
  const d: P3 = [ax / len, ay / len, az / len];
  const ref: P3 = Math.abs(d[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0];
  const u = normalize(cross(d, ref));
  return [u, cross(d, u)];
}

export function cross(a: P3, b: P3): P3 {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

export function normalize(a: P3): P3 {
  const len = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / len, a[1] / len, a[2] / len];
}
