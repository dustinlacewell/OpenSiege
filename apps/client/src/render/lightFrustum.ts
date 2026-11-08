import { TERRAIN_MAX_HEIGHT, type MapSize } from "@mf/sim";
import { multiply, normalize3, setVec3, transform4, vec3, vec4, viewFromBasis, type Mat4 } from "../game/mat4.ts";

/** Beyond this far outside the map nothing casts or receives a shadow worth drawing. */
const MARGIN = 1500;
/** Highest point a caster reaches: the tallest hill plus a factory crane. */
const CASTER_TOP = TERRAIN_MAX_HEIGHT + 300;

const origin = vec3();
const right = vec3();
const up = vec3();
const back = vec3();
const near = vec4();
const far = vec4();
const tmp = vec4();
const box = { minX: 0, maxX: 0, minY: 0, maxY: 0 };
const depth = { near: 0, far: 0 };

/**
 * Fits an orthographic sun frustum around the ground the camera sees, in place.
 * The light-space square is snapped to texel steps and sized in coarse steps so shadows do not shimmer.
 * Returns world units per texel.
 */
export function fitLight(view: Mat4, proj: Mat4, viewProj: Mat4, invCamViewProj: Mat4, sun: readonly number[], resolution: number, map: MapSize): number {
  lightView(view, sun);
  footprint(view, invCamViewProj, map);
  const depth = depthRange(view, map);
  const size = stepUp(Math.max(box.maxX - box.minX, box.maxY - box.minY, 200));
  const texel = size / resolution;
  const cx = Math.floor((box.minX + box.maxX) / 2 / texel) * texel;
  const cy = Math.floor((box.minY + box.maxY) / 2 / texel) * texel;
  ortho(proj, cx - size / 2, cx + size / 2, cy - size / 2, cy + size / 2, depth.near, depth.far);
  multiply(viewProj, proj, view);
  return texel;
}

function lightView(out: Mat4, sun: readonly number[]): void {
  setVec3(back, sun[0]!, sun[1]!, sun[2]!);
  setVec3(right, -back[1]!, back[0]!, 0);
  normalize3(right);
  setVec3(up, back[1]! * right[2]! - back[2]! * right[1]!, back[2]! * right[0]! - back[0]! * right[2]!, back[0]! * right[1]! - back[1]! * right[0]!);
  viewFromBasis(out, origin, right, up, back);
}

/** Light-space x/y bounds of where each screen-corner ray crosses the ground and caster-top planes. */
function footprint(view: Mat4, inv: Mat4, map: MapSize): void {
  box.minX = box.minY = Infinity;
  box.maxX = box.maxY = -Infinity;
  for (let k = 0; k < 4; k++) {
    const x = k & 1 ? 1 : -1;
    const y = k & 2 ? 1 : -1;
    unproject(near, inv, x, y, -1);
    unproject(far, inv, x, y, 1);
    addCrossing(view, 0, map);
    addCrossing(view, CASTER_TOP, map);
  }
}

/** The near→far segment's point at height z, or its far end when it never gets there. Clamped to the map. */
function addCrossing(view: Mat4, z: number, map: MapSize): void {
  const dz = far[2]! - near[2]!;
  const s = Math.abs(dz) < 1e-6 ? 1 : Math.min(1, Math.max(0, (z - near[2]!) / dz));
  const wx = clampAxis(near[0]! + (far[0]! - near[0]!) * s, map.width);
  const wy = clampAxis(near[1]! + (far[1]! - near[1]!) * s, map.height);
  const wz = near[2]! + dz * s;
  transform4(tmp, view, wx, wy, wz, 1);
  box.minX = Math.min(box.minX, tmp[0]!);
  box.maxX = Math.max(box.maxX, tmp[0]!);
  box.minY = Math.min(box.minY, tmp[1]!);
  box.maxY = Math.max(box.maxY, tmp[1]!);
}

/** Near/far of the light frustum: covers the whole map box so off-screen hills still cast. */
function depthRange(view: Mat4, map: MapSize): typeof depth {
  let lo = Infinity, hi = -Infinity;
  for (let k = 0; k < 8; k++) {
    const x = k & 1 ? map.width + MARGIN : -MARGIN;
    const y = k & 2 ? map.height + MARGIN : -MARGIN;
    const z = k & 4 ? CASTER_TOP : 0;
    transform4(tmp, view, x, y, z, 1);
    lo = Math.min(lo, tmp[2]!);
    hi = Math.max(hi, tmp[2]!);
  }
  depth.near = -hi - 10;
  depth.far = -lo + 10;
  return depth;
}

function unproject(out: Float32Array, inv: Mat4, x: number, y: number, z: number): void {
  transform4(out, inv, x, y, z, 1);
  const w = out[3]! || 1;
  out[0] = out[0]! / w;
  out[1] = out[1]! / w;
  out[2] = out[2]! / w;
}

/** Rounds up to an eighth of the next power of two, so zooming changes the size in steps. */
function stepUp(size: number): number {
  const step = Math.pow(2, Math.ceil(Math.log2(size))) / 8;
  return Math.ceil(size / step) * step;
}

/** Clamps to one map axis of length `extent`, plus the margin. */
function clampAxis(v: number, extent: number): number {
  return Math.min(extent + MARGIN, Math.max(-MARGIN, v));
}

function ortho(out: Mat4, l: number, r: number, b: number, t: number, n: number, f: number): void {
  out.fill(0);
  out[0] = 2 / (r - l);
  out[5] = 2 / (t - b);
  out[10] = -2 / (f - n);
  out[12] = -(r + l) / (r - l);
  out[13] = -(t + b) / (t - b);
  out[14] = -(f + n) / (f - n);
  out[15] = 1;
}
