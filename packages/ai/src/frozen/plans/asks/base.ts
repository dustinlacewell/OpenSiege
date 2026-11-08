import { UNIT_STATS } from "@mf/sim";
import type { Board } from "../../board/board.ts";
import { goalsOf } from "../../command/goal.ts";
import type { Knobs } from "../../knobs.ts";
import type { Memory } from "../../memory/memory.ts";
import { homeOf } from "../../plan/plan.ts";
import type { Request } from "../types.ts";
import { wantedAndRest } from "./wanted.ts";

/** One more factory when the life premium at risk (the protect scores) is worth more than a factory, below `factoryTarget`. */
export function baseAsks(board: Board, mem: Memory, knobs: Knobs): Request[] {
  const lives = board.pic.mine.factory.length;
  const atRisk = goalsOf(mem.goals, "protect").reduce((s, g) => s + g.score, 0);
  const more = atRisk > UNIT_STATS.factory.cost && lives < knobs.factoryTarget;
  return wantedAndRest("factory", more ? lives + 1 : lives, more ? atRisk : 0, homeOf(board.pic, mem).site);
}
