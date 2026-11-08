/**
 * Brush strength at distance `d` from the centre, 0..1.
 * `falloff` 0 is a hard disc. 1 is a smooth dome from the centre out.
 */
export function brushWeight(d: number, radius: number, falloff: number): number {
  if (d >= radius) return 0;
  const solid = radius * (1 - falloff);
  if (d <= solid) return 1;
  const t = (radius - d) / (radius - solid);
  return t * t * (3 - 2 * t);
}
