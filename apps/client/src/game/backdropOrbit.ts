// Where the backdrop camera is at time `t`. Pure.
import type { MapSize } from "@mf/sim";

/** A camera pose: look-at point, distance and yaw. */
export interface OrbitPose {
  x: number;
  y: number;
  dist: number;
  yaw: number;
}

/** One lap of the look-at point around the map centre, in seconds. */
const LAP_S = 420;
/** The lap radius, as a share of the map's shorter side. */
const RADIUS = 0.22;
const DIST = 4200;
const DIST_SWING = 700;
const DIST_PERIOD_S = 90;
/** The view looks toward the map centre, plus a slow sway. */
const YAW_INWARD = -Math.PI / 2;
const YAW_SWAY = 0.25;
const YAW_SWAY_PERIOD_S = 60;

/** The backdrop camera at `t` seconds: a slow lap over the map with a gentle yaw drift. */
export function orbitAt(t: number, map: MapSize): OrbitPose {
  const lap = (t / LAP_S) * 2 * Math.PI;
  const r = Math.min(map.width, map.height) * RADIUS;
  return {
    x: map.width / 2 + r * Math.cos(lap),
    y: map.height / 2 + r * Math.sin(lap),
    dist: DIST + DIST_SWING * Math.sin(wave(t, DIST_PERIOD_S)),
    yaw: lap + YAW_INWARD +YAW_SWAY * Math.sin(wave(t, YAW_SWAY_PERIOD_S)),
  };
}

function wave(t: number, period: number): number {
  return (t / period) * 2 * Math.PI;
}
