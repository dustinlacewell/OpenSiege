import { heightAt, TERRAIN_MAX_HEIGHT, UNIT_STATS, type Terrain, type Unit } from "@mf/sim";
import type { Camera } from "./camera.ts";
import { normalize3, setVec3, transform4, vec3, vec4, type Vec3 } from "./mat4.ts";
import type { Vision } from "./vision.ts";

export interface ScreenPoint {
  x: number;
  y: number;
}

export interface Rect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

const MARCH_STEP = 60;
const BISECT_STEPS = 10;
const origin = vec3();
const dir = vec3();
const clip = vec4();
const at = { x: 0, y: 0 };
const edge = { x: 0, y: 0 };

/** World point → CSS pixels. False when the point is behind the camera. */
export function project(cam: Camera, x: number, y: number, z: number, out: ScreenPoint): boolean {
  transform4(clip, cam.viewProj, x, y, z, 1);
  const w = clip[3]!;
  if (w <= 1e-6) return false;
  out.x = (clip[0]! / w * 0.5 + 0.5) * cam.width;
  out.y = (0.5 - clip[1]! / w * 0.5) * cam.height;
  return true;
}

/** The ground point under a CSS pixel. False when the ray points at or above the horizon. */
export function groundAt(cam: Camera, terrain: Terrain | null, sx: number, sy: number, out: Vec3): boolean {
  screenRay(cam, sx, sy);
  if (dir[2]! >= -1e-6) return false;
  return terrain ? marchTerrain(terrain, out) : rayOnFloor(out);
}

/**
 * The nearest unit whose projected centre is within its projected radius plus `slackPx`.
 * Only units `vision` shows: enemies out of sight and radar contacts never pick.
 */
export function unitAtScreen(
  cam: Camera, terrain: Terrain, units: readonly Unit[], vision: Vision, sx: number, sy: number, slackPx: number,
  accept: (u: Unit) => boolean,
): Unit | undefined {
  let best: Unit | undefined;
  let bestD = Infinity;
  for (const u of units) {
    if (!vision.shows(u) || !accept(u) || !projectUnit(cam, terrain, u)) continue;
    const r = projectedRadius(cam, terrain, u) + slackPx;
    const d = (at.x - sx) ** 2 + (at.y - sy) ** 2;
    if (d <= r * r && d < bestD) {
      best = u;
      bestD = d;
    }
  }
  return best;
}

/** Ids of accepted, shown units whose projected centre lies in the rect (any corner order). */
export function unitsInRect(
  cam: Camera, terrain: Terrain, units: readonly Unit[], vision: Vision, rect: Rect, accept: (u: Unit) => boolean,
): number[] {
  const x0 = Math.min(rect.x0, rect.x1), x1 = Math.max(rect.x0, rect.x1);
  const y0 = Math.min(rect.y0, rect.y1), y1 = Math.max(rect.y0, rect.y1);
  const out: number[] = [];
  for (const u of units) {
    if (!vision.shows(u) || !accept(u) || !projectUnit(cam, terrain, u)) continue;
    if (at.x >= x0 && at.x <= x1 && at.y >= y0 && at.y <= y1) out.push(u.id);
  }
  return out;
}

/** Ids of accepted, shown units whose projected centre is on screen. */
export function unitsOnScreen(
  cam: Camera, terrain: Terrain, units: readonly Unit[], vision: Vision, accept: (u: Unit) => boolean,
): number[] {
  return unitsInRect(cam, terrain, units, vision, { x0: 0, y0: 0, x1: cam.width, y1: cam.height }, accept);
}

function screenRay(cam: Camera, sx: number, sy: number): void {
  const nx = (sx / cam.width) * 2 - 1;
  const ny = 1 - (sy / cam.height) * 2;
  unproject(cam, nx, ny, -1, origin);
  unproject(cam, nx, ny, 1, dir);
  normalize3(setVec3(dir, dir[0]! - origin[0]!, dir[1]! - origin[1]!, dir[2]! - origin[2]!));
}

function unproject(cam: Camera, nx: number, ny: number, nz: number, out: Vec3): void {
  transform4(clip, cam.invViewProj, nx, ny, nz, 1);
  const w = clip[3]! || 1;
  setVec3(out, clip[0]! / w, clip[1]! / w, clip[2]! / w);
}

/** March down the ray from the top of the terrain band, then bisect the crossing. */
function marchTerrain(terrain: Terrain, out: Vec3): boolean {
  const dz = -dir[2]!;
  const start = Math.max(0, (origin[2]! - TERRAIN_MAX_HEIGHT) / dz);
  const end = Math.max(start, origin[2]! / dz);
  let prev = start;
  for (let t = start; t <= end + MARCH_STEP; t += MARCH_STEP) {
    if (belowGround(terrain, t)) return bisect(terrain, prev, t, out);
    prev = t;
  }
  return rayOnFloor(out);
}

function bisect(terrain: Terrain, lo: number, hi: number, out: Vec3): boolean {
  for (let i = 0; i < BISECT_STEPS; i++) {
    const mid = (lo + hi) / 2;
    if (belowGround(terrain, mid)) hi = mid;
    else lo = mid;
  }
  pointOnRay(hi, out);
  out[2] = heightAt(terrain, out[0]!, out[1]!);
  return true;
}

function belowGround(terrain: Terrain, t: number): boolean {
  const x = origin[0]! + dir[0]! * t;
  const y = origin[1]! + dir[1]! * t;
  return origin[2]! + dir[2]! * t <= heightAt(terrain, x, y);
}

/** Where the ray crosses z = 0. */
function rayOnFloor(out: Vec3): boolean {
  pointOnRay(origin[2]! / -dir[2]!, out);
  return true;
}

function pointOnRay(t: number, out: Vec3): void {
  setVec3(out, origin[0]! + dir[0]! * t, origin[1]! + dir[1]! * t, origin[2]! + dir[2]! * t);
}

/** Writes the unit's projected centre into `at`. */
function projectUnit(cam: Camera, terrain: Terrain, u: Unit): boolean {
  return project(cam, u.x, u.y, centerZ(terrain, u), at);
}

function projectedRadius(cam: Camera, terrain: Terrain, u: Unit): number {
  const r = UNIT_STATS[u.kind].radius;
  if (!project(cam, u.x + r, u.y, centerZ(terrain, u), edge)) return 0;
  return Math.hypot(edge.x - at.x, edge.y - at.y);
}

function centerZ(terrain: Terrain, u: Unit): number {
  return heightAt(terrain, u.x, u.y) + UNIT_STATS[u.kind].height / 2;
}
