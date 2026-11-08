import { ANGLE_STEPS } from "./stats.ts";

/** Fixed-point scale of the trig table: 1.0 = TRIG_ONE. */
export const TRIG_ONE = 1 << 14;

const QUARTER = ANGLE_STEPS / 4;

/**
 * round(sin(i · 90° / 64) · 2^14) for i = 0..64. A literal, not computed at runtime:
 * Math.sin differs across engines.
 */
const SINE_QUARTER = [
  0, 402, 804, 1205, 1606, 2006, 2404, 2801, 3196, 3590, 3981, 4370, 4756, 5139, 5520, 5897, 6270, 6639, 7005, 7366,
  7723, 8076, 8423, 8765, 9102, 9434, 9760, 10080, 10394, 10702, 11003, 11297, 11585, 11866, 12140, 12406, 12665,
  12916, 13160, 13395, 13623, 13842, 14053, 14256, 14449, 14635, 14811, 14978, 15137, 15286, 15426, 15557, 15679,
  15791, 15893, 15986, 16069, 16143, 16207, 16261, 16305, 16340, 16364, 16379, 16384,
];

/** Sine of an angle in steps, scaled to TRIG_ONE. Any integer step; wraps. */
export function sinStep(a: number): number {
  const s = ((a % ANGLE_STEPS) + ANGLE_STEPS) % ANGLE_STEPS;
  const q = Math.floor(s / QUARTER);
  const r = s % QUARTER;
  if (q === 0) return SINE_QUARTER[r]!;
  if (q === 1) return SINE_QUARTER[QUARTER - r]!;
  if (q === 2) return -SINE_QUARTER[r]!;
  return -SINE_QUARTER[QUARTER - r]!;
}

/** Cosine of an angle in steps, scaled to TRIG_ONE. */
export function cosStep(a: number): number {
  return sinStep(a + QUARTER);
}
