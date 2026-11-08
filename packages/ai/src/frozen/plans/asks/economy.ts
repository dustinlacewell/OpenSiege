import type { Board } from "../../board/board.ts";
import { goalsOf } from "../../command/goal.ts";
import type { Knobs } from "../../knobs.ts";
import type { Memory } from "../../memory/memory.ts";
import { homeOf } from "../../plan/plan.ts";
import type { Request } from "../types.ts";
import { wantedAndRest } from "./wanted.ts";

/** Harvesters: one per slot of the work-field goals, best slots first, at most `harvesterTarget`. The score is that of the slots not yet worked. */
export function economyAsks(board: Board, mem: Memory, knobs: Knobs): Request[] {
  const slots = slotScores(mem).slice(0, knobs.harvesterTarget);
  const missing = slots.slice(board.pic.mine.harvester.length).reduce((s, v) => s + v, 0);
  return wantedAndRest("harvester", slots.length, missing, homeOf(board.pic, mem).site);
}

/** Each work-field goal split into its slots, each at an equal share of the goal score, best first. */
function slotScores(mem: Memory): number[] {
  return goalsOf(mem.goals, "field")
    .flatMap((g) => {
      const n = g.need.count ?? 1;
      return Array.from({ length: n }, () => g.score / n);
    })
    .sort((a, b) => b - a);
}
