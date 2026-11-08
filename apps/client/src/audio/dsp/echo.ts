import { len } from "./buffers.ts";
import { filt } from "./filters.ts";

/** One echo: [delay seconds, gain, low-pass Hz]. */
export type Tap = readonly [sec: number, gain: number, lp: number];

/**
 * Echoes off the land, all 90 ms or later, so they are heard as echoes, never as a comb-filter ring.
 * Each later echo is quieter and darker.
 */
export const LAND_ECHOES: readonly Tap[] = [[0.11, 0.5, 1400], [0.23, 0.35, 1000], [0.41, 0.22, 700]];

/** Pure. The sum of delayed, low-passed copies of `input`, the same length as it. The dry signal is not in it. */
export function echoes(input: Float32Array, sr: number, taps: readonly Tap[]): Float32Array {
  const out = new Float32Array(input.length);
  for (const [sec, gain, lp] of taps) {
    const d = len(sr, sec);
    const tap = new Float32Array(input.length);
    for (let i = d; i < input.length; i++) tap[i] = input[i - d]!;
    filt(tap, sr, "lp", lp, 0.6, 2);
    for (let i = 0; i < out.length; i++) out[i]! += tap[i]! * gain;
  }
  return out;
}
