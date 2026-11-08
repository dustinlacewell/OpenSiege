import { ANGLE_STEPS, GRAVITY, PROJ_FP, type Projectile } from "@mf/sim";

/** A unit's pose before the last step. */
export interface PrevPose {
  x: number;
  y: number;
  facing: number;
  aim: number;
  /** Gun elevation, permille slope. */
  elevation: number;
}

/** A shell's position before the last step, fixed point. */
export interface PrevShot {
  x: number;
  y: number;
  z: number;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** A point in world units. */
export interface WorldPoint {
  x: number;
  y: number;
  z: number;
}

/**
 * Where shell `s` was launched, if it was launched this step, fixed point. The sim launches a
 * shell and flies it one tick in the same step: pos += v, then vz -= GRAVITY. This undoes that.
 */
export function launchPoint(s: Projectile): PrevShot {
  return { x: s.x - s.vx, y: s.y - s.vy, z: s.z - (s.vz + GRAVITY) };
}

/** Writes where shell `s` is drawn at `alpha` (clamped to 0..1) between `prev` and now, in world units. */
export function shotAt(out: WorldPoint, s: Projectile, prev: PrevShot | undefined, alpha: number): WorldPoint {
  const a = Math.min(1, Math.max(0, alpha));
  out.x = (prev ? lerp(prev.x, s.x, a) : s.x) / PROJ_FP;
  out.y = (prev ? lerp(prev.y, s.y, a) : s.y) / PROJ_FP;
  out.z = (prev ? lerp(prev.z, s.z, a) : s.z) / PROJ_FP;
  return out;
}

/** Angle steps from `from` toward `to` the short way, at t, in radians. */
export function lerpAngle(from: number, to: number, t: number): number {
  return facingToRadians(from + facingDelta(from, to) * t);
}

/** Shortest signed turn from `from` to `to`, in angle steps. */
export function facingDelta(from: number, to: number): number {
  const d = (((to - from) % ANGLE_STEPS) + ANGLE_STEPS) % ANGLE_STEPS;
  return d > ANGLE_STEPS / 2 ? d - ANGLE_STEPS : d;
}

export function facingToRadians(facing: number): number {
  return (facing / ANGLE_STEPS) * Math.PI * 2;
}
