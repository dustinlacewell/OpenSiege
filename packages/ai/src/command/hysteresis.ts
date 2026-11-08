import type { Goal } from "./goal.ts";

/** An active goal keeps this share on top of its score, so goals do not flip every run. */
const BONUS = 0.15;

/** Goals with the same id as one from the last run get the bonus. Only positive scores grow. */
export function withHysteresis(goals: readonly Goal[], prev: readonly Goal[]): Goal[] {
  const active = new Set(prev.map((g) => g.id));
  return goals.map((g) => (active.has(g.id) && g.score > 0 ? { ...g, score: g.score * (1 + BONUS) } : g));
}
