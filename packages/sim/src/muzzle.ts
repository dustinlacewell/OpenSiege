import { PROJ_FP, UNIT_STATS, type UnitStats } from "./stats.ts";
import { isqrt } from "./math.ts";
import { heightAt } from "./terrain.ts";
import { hullSlope, type HullSlope } from "./hullSlope.ts";
import { cosStep, sinStep, TRIG_ONE } from "./trig.ts";
import type { Fp3 } from "./features/featureHit.ts";
import type { Terrain, Unit } from "./types.ts";

// Where a gun's shells start: the barrel tip, placed the way the client's unit shader places it
// (sink, turret turn, hull tilt, hull yaw). Pure integer math on the `gun*` stats and `sink`.

/** A kind with no barrel (`gunLength` 0) fires from its centre, this percent of its height up. */
const CENTRE_PCT = 70;
/** Slopes are permille: rise per this much run. */
const RUN = 1000;

/** What of a unit places its barrel. */
export type Mount = Pick<Unit, "kind" | "x" | "y" | "facing" | "mode">;

/**
 * The barrel tip of `u` on `terrain`, turret aimed `aim` angle steps, barrel raised to `slope` permille
 * in the world. Fixed point. The breech pivot rides the hull: sunk by `sink` when sieged, tilted to the slope.
 * The barrel from the pivot points along `aim` at `slope`, as the client draws it (`game/gunPitch.ts`).
 */
export function muzzleTip(u: Mount, terrain: Terrain, aim: number, slope: number): Fp3 {
  const s = UNIT_STATS[u.kind];
  const ground = heightAt(terrain, u.x, u.y);
  if (s.gunLength <= 0) return { x: u.x * PROJ_FP, y: u.y * PROJ_FP, z: (ground + Math.floor((s.height * CENTRE_PCT) / 100)) * PROJ_FP };
  const tilt = hullSlope(terrain, u.x, u.y, u.facing, s.radius);
  const pivot = yaw(tilted(turretPivot(s, aim - u.facing, u.mode === "sieged"), tilt), u.facing);
  const tube = barrel(s.gunLength, aim, slope);
  return {
    x: u.x * PROJ_FP + pivot.x + tube.x,
    y: u.y * PROJ_FP + pivot.y + tube.y,
    z: ground * PROJ_FP + pivot.z + tube.z,
  };
}

/** The breech pivot in the hull frame: turned `turn` steps with the turret, sunk when sieged. */
function turretPivot(s: UnitStats, turn: number, sieged: boolean): Fp3 {
  return {
    x: Math.trunc((s.gunX * PROJ_FP * cosStep(turn)) / TRIG_ONE),
    y: Math.trunc((s.gunX * PROJ_FP * sinStep(turn)) / TRIG_ONE),
    z: (s.gunZ - (sieged ? s.sink : 0)) * PROJ_FP,
  };
}

/** The shader's `tilt`: roll about +x by the side slope, then pitch about +y by the forward slope. */
function tilted(v: Fp3, slope: HullSlope): Fp3 {
  const r = slope.side, hr = isqrt(RUN * RUN + r * r);
  const y = Math.trunc((v.y * RUN - v.z * r) / hr);
  const z1 = Math.trunc((v.y * r + v.z * RUN) / hr);
  const p = slope.fwd, hp = isqrt(RUN * RUN + p * p);
  return {
    x: Math.trunc((v.x * RUN - z1 * p) / hp),
    y,
    z: Math.trunc((v.x * p + z1 * RUN) / hp),
  };
}

/** Turn a hull-frame vector by the hull yaw `facing` steps about z. */
function yaw(v: Fp3, facing: number): Fp3 {
  const c = cosStep(facing), s = sinStep(facing);
  return { x: Math.trunc((v.x * c - v.y * s) / TRIG_ONE), y: Math.trunc((v.x * s + v.y * c) / TRIG_ONE), z: v.z };
}

/** A barrel `length` long pointing along world bearing `aim` at `slope` permille, fixed point. */
function barrel(length: number, aim: number, slope: number): Fp3 {
  const hyp = isqrt(RUN * RUN + slope * slope);
  const run = Math.trunc((length * PROJ_FP * RUN) / hyp);
  return {
    x: Math.trunc((run * cosStep(aim)) / TRIG_ONE),
    y: Math.trunc((run * sinStep(aim)) / TRIG_ONE),
    z: Math.trunc((length * PROJ_FP * slope) / hyp),
  };
}
