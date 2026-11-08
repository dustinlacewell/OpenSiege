import { clampX, clampY, heightAt, mapCentre, type MapSize, type Terrain } from "@mf/sim";
import { invert, mat4, multiply, perspective, setVec3, vec3, viewFromBasis, type Mat4, type Vec3 } from "./mat4.ts";

/**
 * RTS camera: orbits a ground point at `yaw`, tilted down by `pitch`.
 * At yaw 0 it looks from the south (north is up on screen). World x is east, y is south, z is up.
 * Mutable: input changes the look-at point, distance, yaw and tilt, then `updateMatrices` derives the rest.
 */
export interface Camera {
  x: number;
  y: number;
  /** Look-at height. Follows the ground under (x, y) smoothly. */
  z: number;
  dist: number;
  /** Viewport in CSS pixels. */
  width: number;
  height: number;
  /** Radians above the horizon. Derived from `dist` plus `tilt`. */
  pitch: number;
  /** Radians the view is turned around the look-at point. 0 looks north; positive turns clockwise from above. */
  yaw: number;
  /** The map the look-at point is kept on. {0,0} until `setCameraMap`. */
  map: MapSize;
  /** User pitch offset in radians, added to the zoom-driven pitch. */
  tilt: number;
  readonly eye: Vec3;
  readonly right: Vec3;
  readonly up: Vec3;
  readonly back: Vec3;
  readonly view: Mat4;
  readonly proj: Mat4;
  readonly viewProj: Mat4;
  readonly invViewProj: Mat4;
}

export const MIN_DIST = 600;
export const MAX_DIST = 14000;
export const FOV_Y = (40 * Math.PI) / 180;
const PITCH_NEAR = (45 * Math.PI) / 180;
const PITCH_FAR = (65 * Math.PI) / 180;
const PITCH_MIN = (25 * Math.PI) / 180;
const PITCH_MAX = (85 * Math.PI) / 180;
const FOLLOW_RATE = 5;

export function createCamera(width: number, height: number): Camera {
  const cam: Camera = {
    x: 0, y: 0, z: 0, dist: 3000, width, height, pitch: PITCH_NEAR, yaw: 0, map: { width: 0, height: 0 }, tilt: 0,
    eye: vec3(), right: vec3(1, 0, 0), up: vec3(), back: vec3(),
    view: mat4(), proj: mat4(), viewProj: mat4(), invViewProj: mat4(),
  };
  updateMatrices(cam);
  return cam;
}

/** Binds the camera to a map and centres it there. Call on every path that sets a world. */
export function setCameraMap(cam: Camera, map: MapSize): void {
  cam.map = map;
  const c = mapCentre(map);
  centerOn(cam, c.x, c.y);
}

/** World units per CSS pixel at the look-at point. */
export function worldPerPixel(cam: Camera): number {
  return (2 * cam.dist * Math.tan(FOV_Y / 2)) / Math.max(1, cam.height);
}

/** Pan by a screen delta in CSS pixels: dragging right moves the world right, relative to the current yaw. */
export function pan(cam: Camera, dx: number, dy: number): void {
  const k = worldPerPixel(cam);
  const along = (dy * k) / Math.sin(cam.pitch);
  const [rx, ry] = groundRight(cam.yaw);
  cam.x += -rx * dx * k + ry * along;
  cam.y += -ry * dx * k - rx * along;
  clamp(cam);
}

export function centerOn(cam: Camera, x: number, y: number): void {
  cam.x = x;
  cam.y = y;
  clamp(cam);
}

export function setDistance(cam: Camera, dist: number): void {
  cam.dist = dist;
  clamp(cam);
}

/** Turns the view around the look-at point. */
export function rotate(cam: Camera, radians: number): void {
  cam.yaw = (cam.yaw + radians) % (2 * Math.PI);
}

/** Adds to the user tilt, keeping the final pitch inside its range at the current distance. */
export function addTilt(cam: Camera, radians: number): void {
  const auto = autoPitch(cam.dist);
  cam.tilt = Math.min(PITCH_MAX - auto, Math.max(PITCH_MIN - auto, cam.tilt + radians));
}

export function resize(cam: Camera, width: number, height: number): void {
  cam.width = width;
  cam.height = height;
}

/** Eases the look-at height toward the ground, then rebuilds the matrices. Call once per frame. */
export function followGround(cam: Camera, terrain: Terrain | null, dt: number): void {
  if (terrain) cam.z += (heightAt(terrain, cam.x, cam.y) - cam.z) * (1 - Math.exp(-dt * FOLLOW_RATE));
  updateMatrices(cam);
}

export function updateMatrices(cam: Camera): void {
  cam.pitch = Math.min(PITCH_MAX, Math.max(PITCH_MIN, autoPitch(cam.dist) + cam.tilt));
  writeBasis(cam);
  setVec3(cam.eye, cam.x + cam.dist * cam.back[0]!, cam.y + cam.dist * cam.back[1]!, cam.z + cam.dist * cam.back[2]!);
  // x right, y down, z up is left-handed; this basis mirrors it into a right-handed view space.
  viewFromBasis(cam.view, cam.eye, cam.right, cam.up, cam.back);
  const near = Math.max(5, cam.dist * 0.05);
  perspective(cam.proj, FOV_Y, cam.width / Math.max(1, cam.height), near, cam.dist * 3 + 12000);
  multiply(cam.viewProj, cam.proj, cam.view);
  invert(cam.invViewProj, cam.viewProj);
}

/** Zoom-driven pitch: steeper when far out. */
function autoPitch(dist: number): number {
  const t = (dist - MIN_DIST) / (MAX_DIST - MIN_DIST);
  return PITCH_NEAR + (PITCH_FAR - PITCH_NEAR) * Math.sqrt(Math.max(0, t));
}

/** Screen-right on the ground plane. Screen-up on the ground (away from the camera) is (ry, -rx). */
function groundRight(yaw: number): [number, number] {
  return [Math.cos(yaw), Math.sin(yaw)];
}

function writeBasis(cam: Camera): void {
  const c = Math.cos(cam.pitch);
  const s = Math.sin(cam.pitch);
  const [rx, ry] = groundRight(cam.yaw);
  const fx = ry, fy = -rx;
  setVec3(cam.right, rx, ry, 0);
  setVec3(cam.back, -fx * c, -fy * c, s);
  setVec3(cam.up, fx * s, fy * s, c);
}

/** Keeps the look-at point on the map and the distance in range. */
function clamp(cam: Camera): void {
  cam.x = clampX(cam.map, cam.x);
  cam.y = clampY(cam.map, cam.y);
  cam.dist = Math.min(MAX_DIST, Math.max(MIN_DIST, cam.dist));
}
