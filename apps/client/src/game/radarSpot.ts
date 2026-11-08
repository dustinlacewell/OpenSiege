import { hash01 } from "./hash01.ts";

/** Most distance between a radar dot and the unit's true place, world units. */
export const RADAR_JITTER = 180;
/** Seconds each offset holds before it drifts to the next. */
const DRIFT_S = 2.5;
const TURN = Math.PI * 2;

export interface Spot {
  x: number;
  y: number;
}

/**
 * Writes the radar offset of unit `id` at `time` seconds into `out`. Pure: same id and time, same offset.
 * Every DRIFT_S seconds the unit gets a new random point in a disc of RADAR_JITTER, and the offset
 * glides there smoothly. Each unit's clock is shifted by its own phase, so dots do not move in step.
 */
export function radarOffset(id: number, time: number, out: Spot): Spot {
  const t = time / DRIFT_S + hash01(id, 0, 7);
  const k = Math.floor(t);
  const f = smooth(t - k);
  out.x = pointX(id, k) * (1 - f) + pointX(id, k + 1) * f;
  out.y = pointY(id, k) * (1 - f) + pointY(id, k + 1) * f;
  return out;
}

function pointX(id: number, k: number): number {
  return Math.cos(hash01(id, k, 1) * TURN) * Math.sqrt(hash01(id, k, 2)) * RADAR_JITTER;
}

function pointY(id: number, k: number): number {
  return Math.sin(hash01(id, k, 1) * TURN) * Math.sqrt(hash01(id, k, 2)) * RADAR_JITTER;
}

function smooth(f: number): number {
  return f * f * (3 - 2 * f);
}
