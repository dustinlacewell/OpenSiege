import type { Board } from "../board/board.ts";
import type { Knobs } from "../knobs.ts";
import type { Memory } from "../memory/memory.ts";
import { attackGoals } from "./attack.ts";
import { commandContext } from "./context.ts";
import { defendGoals } from "./defend.ts";
import { fieldGoals } from "./field.ts";
import type { Goal } from "./goal.ts";
import { withHysteresis } from "./hysteresis.ts";
import { protectGoals } from "./protect.ts";
import { scoutGoals } from "./scout.ts";

/** Every goal the bot could pursue, scored in credits. Goals from the last run keep a bonus; goals at or below zero drop. */
export function command(board: Board, mem: Memory, knobs: Knobs): Goal[] {
  const c = commandContext(board, knobs);
  const goals = [...protectGoals(c), ...fieldGoals(c), ...attackGoals(c), ...defendGoals(c), ...scoutGoals(c, mem.explored)];
  return withHysteresis(goals, mem.goals).filter((g) => g.score > 0);
}
