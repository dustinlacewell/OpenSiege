import type { UnitKind } from "@mf/sim";
import { artillery, mine, tank } from "./meshCombat.ts";
import { engineer, factory, harvester, jammer, radar } from "./meshSupport.ts";

/**
 * A mast that siege raises. `MAST` and `DISH` parts are modelled raised. When mobile they turn
 * `fold` radians about a y axis through the hinge (x, z). Negative `fold` tips the top forward.
 */
export interface MastFold {
  x: number;
  z: number;
  fold: number;
}

/** One unit kind's model, in world units: +x forward, z up from the ground. */
export interface UnitMesh {
  vertices: Float32Array;
  /** How far the legs are raised when folded. */
  legLift: number;
  /** Hull paint, sRGB. */
  base: readonly [number, number, number];
  /** The hinge of the `MAST` and `DISH` parts. Absent when the model has none. */
  mast?: MastFold;
  /** The breech pivot (x, z) the `BARREL` parts pitch about. Absent when the model has no barrel. */
  gun?: { x: number; z: number };
}

export const UNIT_MESHES: Record<UnitKind, () => UnitMesh> = {
  factory, harvester, engineer, radar, jammer, tank, artillery, mine,
};
