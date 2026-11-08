import type { MapSpec } from "@mf/sim";
import type { Difficulty } from "../../index.ts";
import { KNOBS } from "../knobs.ts";
import { pickStartSpot, type Spot, type TakenSpot } from "./pickStartSpot.ts";

/** `pickStartSpot` with the start knobs of a difficulty. */
export function botStartSpot(spec: MapSpec, taken: readonly TakenSpot[], me: { team: number }, difficulty: Difficulty, seed: number): Spot {
  return pickStartSpot(spec, taken, me, KNOBS[difficulty].start, seed);
}
