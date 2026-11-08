import type { UnitKind } from "@mf/sim";
import type { Point } from "../geometry.ts";

export type GoalKind = "protect" | "field" | "attack" | "defend" | "scout";

/** What a goal still lacks. `power` is the power missing at the goal, net of the own power already there. */
export interface Need {
  kind?: UnitKind;
  count?: number;
  power?: number;
}

/** One thing the bot wants. `score` is in credits: the expected change in balance (`docs/architecture/ai/command.md`). */
export interface Goal {
  id: string;
  kind: GoalKind;
  at: Point;
  score: number;
  need: Need;
}

export function goalsOf(goals: readonly Goal[], kind: GoalKind): Goal[] {
  return goals.filter((g) => g.kind === kind);
}
