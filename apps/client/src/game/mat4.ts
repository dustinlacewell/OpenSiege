/** Column-major 4x4 matrices and 3-vectors on Float32Array. Every function writes into `out`. */
export type Mat4 = Float32Array;
export type Vec3 = Float32Array;
export type Vec4 = Float32Array;

export function mat4(): Mat4 {
  return new Float32Array(16);
}

export function vec3(x = 0, y = 0, z = 0): Vec3 {
  return new Float32Array([x, y, z]);
}

export function vec4(): Vec4 {
  return new Float32Array(4);
}

export function setVec3(out: Vec3, x: number, y: number, z: number): Vec3 {
  out[0] = x;
  out[1] = y;
  out[2] = z;
  return out;
}

export function dot3(a: Vec3, b: Vec3): number {
  return a[0]! * b[0]! + a[1]! * b[1]! + a[2]! * b[2]!;
}

export function normalize3(out: Vec3): Vec3 {
  const len = Math.hypot(out[0]!, out[1]!, out[2]!) || 1;
  return setVec3(out, out[0]! / len, out[1]! / len, out[2]! / len);
}

/** OpenGL-style perspective: view space looks down -z, clip z in -1..1. */
export function perspective(out: Mat4, fovY: number, aspect: number, near: number, far: number): Mat4 {
  const f = 1 / Math.tan(fovY / 2);
  out.fill(0);
  out[0] = f / aspect;
  out[5] = f;
  out[10] = (far + near) / (near - far);
  out[11] = -1;
  out[14] = (2 * far * near) / (near - far);
  return out;
}

/** View matrix whose rows are the camera basis vectors. `back` points from the target to the eye. */
export function viewFromBasis(out: Mat4, eye: Vec3, right: Vec3, up: Vec3, back: Vec3): Mat4 {
  out[0] = right[0]!; out[4] = right[1]!; out[8] = right[2]!; out[12] = -dot3(right, eye);
  out[1] = up[0]!; out[5] = up[1]!; out[9] = up[2]!; out[13] = -dot3(up, eye);
  out[2] = back[0]!; out[6] = back[1]!; out[10] = back[2]!; out[14] = -dot3(back, eye);
  out[3] = 0; out[7] = 0; out[11] = 0; out[15] = 1;
  return out;
}

/** out = a · b. `out` must not alias `a` or `b`. */
export function multiply(out: Mat4, a: Mat4, b: Mat4): Mat4 {
  for (let c = 0; c < 4; c++) {
    const b0 = b[c * 4]!, b1 = b[c * 4 + 1]!, b2 = b[c * 4 + 2]!, b3 = b[c * 4 + 3]!;
    for (let r = 0; r < 4; r++) {
      out[c * 4 + r] = a[r]! * b0 + a[4 + r]! * b1 + a[8 + r]! * b2 + a[12 + r]! * b3;
    }
  }
  return out;
}

/** out = m⁻¹. Returns false (and leaves `out` alone) when m is singular. */
export function invert(out: Mat4, m: Mat4): boolean {
  const a00 = m[0]!, a01 = m[1]!, a02 = m[2]!, a03 = m[3]!;
  const a10 = m[4]!, a11 = m[5]!, a12 = m[6]!, a13 = m[7]!;
  const a20 = m[8]!, a21 = m[9]!, a22 = m[10]!, a23 = m[11]!;
  const a30 = m[12]!, a31 = m[13]!, a32 = m[14]!, a33 = m[15]!;
  const b00 = a00 * a11 - a01 * a10, b01 = a00 * a12 - a02 * a10, b02 = a00 * a13 - a03 * a10;
  const b03 = a01 * a12 - a02 * a11, b04 = a01 * a13 - a03 * a11, b05 = a02 * a13 - a03 * a12;
  const b06 = a20 * a31 - a21 * a30, b07 = a20 * a32 - a22 * a30, b08 = a20 * a33 - a23 * a30;
  const b09 = a21 * a32 - a22 * a31, b10 = a21 * a33 - a23 * a31, b11 = a22 * a33 - a23 * a32;
  const det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
  if (Math.abs(det) < 1e-12) return false;
  const k = 1 / det;
  out[0] = (a11 * b11 - a12 * b10 + a13 * b09) * k;
  out[1] = (a02 * b10 - a01 * b11 - a03 * b09) * k;
  out[2] = (a31 * b05 - a32 * b04 + a33 * b03) * k;
  out[3] = (a22 * b04 - a21 * b05 - a23 * b03) * k;
  out[4] = (a12 * b08 - a10 * b11 - a13 * b07) * k;
  out[5] = (a00 * b11 - a02 * b08 + a03 * b07) * k;
  out[6] = (a32 * b02 - a30 * b05 - a33 * b01) * k;
  out[7] = (a20 * b05 - a22 * b02 + a23 * b01) * k;
  out[8] = (a10 * b10 - a11 * b08 + a13 * b06) * k;
  out[9] = (a01 * b08 - a00 * b10 - a03 * b06) * k;
  out[10] = (a30 * b04 - a31 * b02 + a33 * b00) * k;
  out[11] = (a21 * b02 - a20 * b04 - a23 * b00) * k;
  out[12] = (a11 * b07 - a10 * b09 - a12 * b06) * k;
  out[13] = (a00 * b09 - a01 * b07 + a02 * b06) * k;
  out[14] = (a31 * b01 - a30 * b03 - a32 * b00) * k;
  out[15] = (a20 * b03 - a21 * b01 + a22 * b00) * k;
  return true;
}

/** out = m · (x, y, z, w). */
export function transform4(out: Vec4, m: Mat4, x: number, y: number, z: number, w: number): Vec4 {
  out[0] = m[0]! * x + m[4]! * y + m[8]! * z + m[12]! * w;
  out[1] = m[1]! * x + m[5]! * y + m[9]! * z + m[13]! * w;
  out[2] = m[2]! * x + m[6]! * y + m[10]! * z + m[14]! * w;
  out[3] = m[3]! * x + m[7]! * y + m[11]! * z + m[15]! * w;
  return out;
}
