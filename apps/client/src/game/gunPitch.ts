/**
 * Barrel elevation limits in the turret frame, radians: keeps a bad value from folding the barrel
 * into the hull or past vertical. Wide enough for a howitzer's high lob.
 */
export const GUN_MIN = (-30 * Math.PI) / 180;
export const GUN_MAX = (85 * Math.PI) / 180;
/** Limit on the barrel's swing off the turret's forward axis, radians: the slope tilt needs only a few degrees. */
export const SWING_MAX = (45 * Math.PI) / 180;

/** The hull's world attitude, radians, as the unit shader applies it (roll, then pitch, then yaw). */
export interface HullAttitude {
  yaw: number;
  pitch: number;
  roll: number;
}

/** How the barrel turns about its breech pivot, radians. */
export interface GunPose {
  /** Pitch from its modelled rest elevation; positive raises the muzzle. */
  gun: number;
  /** Turn about the hull's up axis on top of the turret turn (`aim − yaw`). */
  swing: number;
}

type V3 = [number, number, number];

/**
 * The barrel pose that points the drawn barrel along world bearing `aim` raised to `permille` of slope,
 * from a mesh modelled at `rest` elevation. Solved in the hull-tilted frame, so the slope tilt does not
 * swing the barrel off the aim. Clamped to GUN_MIN…GUN_MAX and ±SWING_MAX.
 */
export function gunPose(permille: number, rest: number, aim: number, hull: HullAttitude): GunPose {
  const [x, y, z] = intoHull(worldAim(aim, Math.atan(permille / 1000)), hull);
  const elevation = clamp(Math.atan2(z, Math.hypot(x, y)), GUN_MIN, GUN_MAX);
  const swing = clamp(wrap(Math.atan2(y, x) - (aim - hull.yaw)), -SWING_MAX, SWING_MAX);
  return { gun: elevation - rest, swing };
}

/** Unit vector along world bearing `aim` at elevation `e`. */
function worldAim(aim: number, e: number): V3 {
  return [Math.cos(e) * Math.cos(aim), Math.cos(e) * Math.sin(aim), Math.sin(e)];
}

/** A world vector in the hull frame: undo the yaw, then the shader's `tilt` (pitch, then roll). */
function intoHull([x, y, z]: V3, h: HullAttitude): V3 {
  [x, y] = rot(x, y, -h.yaw);
  [x, z] = rot(x, z, -h.pitch);
  [y, z] = rot(y, z, -h.roll);
  return [x, y, z];
}

function rot(a: number, b: number, angle: number): [number, number] {
  const c = Math.cos(angle), s = Math.sin(angle);
  return [c * a - s * b, s * a + c * b];
}

/** `a` in (−π, π]. */
function wrap(a: number): number {
  return a - 2 * Math.PI * Math.ceil((a - Math.PI) / (2 * Math.PI));
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}
