import type { LineSink, LineStyle } from "./groundLines.ts";

/** Straight pieces per arc. */
const STEPS = 16;

/** A parabola in the air from a to b. Its middle sits `rise` above the straight chord. Opacity falls from 1 to `fadeEnd`. */
export function arc(
  sink: LineSink,
  ax: number, ay: number, az: number,
  bx: number, by: number, bz: number,
  rise: number, style: LineStyle, fadeEnd: number,
): void {
  let px = ax, py = ay, pz = az, pf = 1;
  for (let k = 1; k <= STEPS; k++) {
    const s = k / STEPS;
    const x = ax + (bx - ax) * s;
    const y = ay + (by - ay) * s;
    const z = az + (bz - az) * s + 4 * rise * s * (1 - s);
    const f = 1 + (fadeEnd - 1) * s;
    sink.segment(px, py, pz, x, y, z, style, pf, f);
    px = x; py = y; pz = z; pf = f;
  }
}
