import { muzzleTip, PROJ_FP, UNIT_STATS, type Mount, type Terrain, type Unit, type UnitKind } from "@mf/sim";
import type { PrevPose } from "./interp.ts";

/** A barrel in turret space: +x forward, z up, pivot at the unit origin. Lengths in world units. */
export interface Barrel {
  /** Breech point the barrel starts from and pitches about. */
  x: number;
  z: number;
  length: number;
  /** Radians above level, as modelled: the sim's `gunRest`. */
  elevation: number;
  radius: number;
}

/** Tube radius: the one barrel field the sim does not need. */
const RADIUS: Partial<Record<UnitKind, number>> = { tank: 3, artillery: 4 };
const DEFAULT_RADIUS = 3;

/** The barrel of `kind` from its sim `gun*` stats; undefined when it has none (`gunLength` 0). */
export function barrelOf(kind: UnitKind): Barrel | undefined {
  const s = UNIT_STATS[kind];
  if (s.gunLength <= 0) return undefined;
  return { x: s.gunX, z: s.gunZ, length: s.gunLength, elevation: restElevation(kind), radius: RADIUS[kind] ?? DEFAULT_RADIUS };
}

/** The elevation `kind`'s barrel is modelled at, radians: the sim's `gunRest`. */
export function restElevation(kind: UnitKind): number {
  return (UNIT_STATS[kind].gunRest * Math.PI) / 180;
}

export function muzzleX(b: Barrel): number {
  return b.x + Math.cos(b.elevation) * b.length;
}

export function muzzleZ(b: Barrel): number {
  return b.z + Math.sin(b.elevation) * b.length;
}

/**
 * Where `u`'s muzzle flash shows on `terrain`, in world units: the sim's barrel tip at the pose `u`
 * had at the start of the firing tick, `prev`, which is where the shell left. Without `prev` (just
 * spawned) it uses `u`'s current pose.
 */
export function flashPoint(
  u: Mount & Pick<Unit, "aim" | "elevation">,
  prev: PrevPose | undefined,
  terrain: Terrain,
): { x: number; y: number; z: number } {
  const p = prev ?? u;
  const tip = muzzleTip({ kind: u.kind, mode: u.mode, x: p.x, y: p.y, facing: p.facing }, terrain, p.aim, p.elevation);
  return { x: tip.x / PROJ_FP, y: tip.y / PROJ_FP, z: tip.z / PROJ_FP };
}
