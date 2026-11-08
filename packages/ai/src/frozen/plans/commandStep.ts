import { command } from "../command/command.ts";
import type { Plan, PlanResult } from "../plan/plan.ts";

/** The commander as a step slot: it moves no units and keeps its goals in memory until its next run. */
export function commandStep(p: Plan): PlanResult {
  return { assign: [], intents: [], memory: { goals: command(p.board, p.mem, p.knobs) } };
}
