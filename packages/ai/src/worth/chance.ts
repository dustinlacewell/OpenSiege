/** The chance a force of power `own` beats `enemy`, by the square law: r² ÷ (1 + r²), r = own ÷ enemy. No enemy: 1. */
export function chance(own: number, enemy: number): number {
  if (enemy <= 0) return 1;
  const r2 = (own / enemy) ** 2;
  return r2 / (1 + r2);
}
