import type { PlannerName } from "../memory/memory.ts";
import { planArmy } from "../plan/army.ts";
import { planArtillery } from "../plan/artillery.ts";
import { planBase } from "../plan/base.ts";
import { planEconomy } from "../plan/economy.ts";
import type { Planner } from "../plan/plan.ts";
import { planSupport } from "../plan/support.ts";
import { planProduction } from "../produce/produce.ts";
import { artilleryAsks, tankAsks } from "./asks/army.ts";
import { baseAsks } from "./asks/base.ts";
import { economyAsks } from "./asks/economy.ts";
import { supportAsks } from "./asks/support.ts";
import { commandStep } from "./commandStep.ts";
import type { PlanKind } from "./types.ts";

/** How often a slot runs. `offset` staggers the first run, so slots spread over ticks. */
export interface Timing {
  name: PlannerName;
  every: number;
  offset: number;
}

/** A plan: it asks for units and runs with the units it was given. */
export interface PlanSlot extends Timing {
  plan: PlanKind;
}

/** A step that owns no units. */
export interface StepSlot extends Timing {
  step: Planner;
}

export type Slot = PlanSlot | StepSlot;

export const BASE: PlanKind = { id: "base", requests: baseAsks, run: planBase };
export const ECONOMY: PlanKind = { id: "economy", requests: economyAsks, run: planEconomy };
export const ARMY: PlanKind = { id: "army", requests: tankAsks, run: planArmy };
export const ARTILLERY: PlanKind = { id: "artillery", requests: artilleryAsks, run: planArtillery };
export const SUPPORT: PlanKind = { id: "support", requests: supportAsks, run: planSupport };

/**
 * Run order matters: the commander sets the goals the requests read; base sets the site the others read; army sets
 * the squads that artillery and support follow.
 */
export const SCHEDULE: readonly Slot[] = [
  { name: "command", every: 20, offset: 0, step: commandStep },
  { name: "base", every: 20, offset: 0, plan: BASE },
  { name: "economy", every: 10, offset: 0, plan: ECONOMY },
  { name: "production", every: 10, offset: 3, step: planProduction },
  { name: "army", every: 5, offset: 1, plan: ARMY },
  { name: "artillery", every: 5, offset: 2, plan: ARTILLERY },
  { name: "support", every: 10, offset: 6, plan: SUPPORT },
];

/** Every plan in the schedule, in run order. The allocator serves all of them each think, due or not. */
export const PLANS: readonly PlanKind[] = SCHEDULE.flatMap((s) => ("plan" in s ? [s.plan] : []));

/** Due when its period has passed since the last run. Before the first run, due from its offset. */
export function isDue(slot: Timing, last: number, tick: number): boolean {
  return last < 0 ? tick >= slot.offset : tick - last >= slot.every;
}
