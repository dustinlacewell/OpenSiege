import { holdRange } from "./targeting.ts";

/** The distances a firing unit holds between: no nearer than `near`, no farther than `far`. */
export interface HoldBand { near: number; far: number }

/**
 * The hold band of a weapon with effective range `range` and minimum range `minRange`.
 * `near` is `minRange` plus one eighth of it, capped at `far`; `far` is `holdRange(range)`. `minRange` 0 gives `near` 0.
 */
export function holdBand(range: number, minRange: number): HoldBand {
  const far = holdRange(range);
  return { near: Math.min(far, minRange + Math.floor(minRange / 8)), far };
}
