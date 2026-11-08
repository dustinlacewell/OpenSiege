import { heightAt, UNIT_STATS, type Terrain, type Unit, type World } from "@mf/sim";
import { gunPose } from "./gunPitch.ts";
import { facingToRadians, lerp, lerpAngle, type PrevPose } from "./interp.ts";
import { restElevation } from "./muzzle.ts";

/** A unit as drawn this frame: interpolated, on the ground, tilted to the slope. Angles in radians. */
export interface UnitPose {
  unit: Unit;
  x: number;
  y: number;
  z: number;
  yaw: number;
  aim: number;
  pitch: number;
  roll: number;
  /** 0 mobile … 1 fully sieged. */
  siege: number;
  /** Barrel pitch from its modelled rest elevation, in the tilted turret frame. Drawn only by kinds with a barrel. */
  gun: number;
  /** Barrel turn about its pivot on top of the turret turn, so the slope tilt does not swing it off the aim. */
  swing: number;
}

/** Reused every frame: `poses[0..count)` are valid. */
export interface PoseTable {
  poses: UnitPose[];
  count: number;
}

export function createPoseTable(): PoseTable {
  return { poses: [], count: 0 };
}

export function fillPoses(table: PoseTable, world: World, prev: ReadonlyMap<number, PrevPose>, alpha: number): void {
  const a = Math.min(1, Math.max(0, alpha));
  table.count = 0;
  for (const u of world.units) {
    const p = slot(table);
    const was = prev.get(u.id);
    place(p, u, was, a);
    settle(p, world.terrain, UNIT_STATS[u.kind].radius * 0.8);
    p.siege = siegeProgress(u, a);
    aimGun(p, was ? lerp(was.elevation, u.elevation, a) : u.elevation);
  }
}

/** Barrel pitch and swing for the pose's aim at `elevation` permille. */
function aimGun(p: UnitPose, elevation: number): void {
  const g = gunPose(elevation, restElevation(p.unit.kind), p.aim, p);
  p.gun = g.gun;
  p.swing = g.swing;
}

function slot(table: PoseTable): UnitPose {
  let p = table.poses[table.count];
  if (!p) {
    p = { unit: null!, x: 0, y: 0, z: 0, yaw: 0, aim: 0, pitch: 0, roll: 0, siege: 0, gun: 0, swing: 0 };
    table.poses.push(p);
  }
  table.count++;
  return p;
}

function place(p: UnitPose, u: Unit, prev: PrevPose | undefined, a: number): void {
  p.unit = u;
  if (!prev) {
    p.x = u.x;
    p.y = u.y;
    p.yaw = facingToRadians(u.facing);
    p.aim = facingToRadians(u.aim);
    return;
  }
  p.x = lerp(prev.x, u.x, a);
  p.y = lerp(prev.y, u.y, a);
  p.yaw = lerpAngle(prev.facing, u.facing, a);
  p.aim = lerpAngle(prev.aim, u.aim, a);
}

/** Ground height, and pitch/roll from samples `d` ahead, behind, left and right. */
function settle(p: UnitPose, t: Terrain, d: number): void {
  const fx = Math.cos(p.yaw) * d;
  const fy = Math.sin(p.yaw) * d;
  p.z = heightAt(t, p.x, p.y);
  p.pitch = Math.atan((heightAt(t, p.x + fx, p.y + fy) - heightAt(t, p.x - fx, p.y - fy)) / (2 * d));
  p.roll = Math.atan((heightAt(t, p.x - fy, p.y + fx) - heightAt(t, p.x + fy, p.y - fx)) / (2 * d));
}

/** Binary search: poses follow `world.units`, which the sim keeps sorted by id. */
export function poseById(table: PoseTable, id: number): UnitPose | undefined {
  let lo = 0;
  let hi = table.count - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const p = table.poses[mid]!;
    if (p.unit.id === id) return p;
    if (p.unit.id < id) lo = mid + 1;
    else hi = mid - 1;
  }
  return undefined;
}

function siegeProgress(u: Unit, a: number): number {
  const ticks = UNIT_STATS[u.kind].siegeTicks;
  if (u.mode === "sieged") return 1;
  if (u.mode === "mobile" || ticks <= 0) return 0;
  const left = Math.max(0, u.modeTimer - a) / ticks;
  return u.mode === "deploying" ? 1 - left : left;
}
