import type { PlannerName } from "../memory/memory.ts";
import { planArmy } from "./army.ts";
import { planArtillery } from "./artillery.ts";
import { planBase } from "./base.ts";
import { planEconomy } from "./economy.ts";
import type { Planner } from "./plan.ts";
import { planProduction } from "./production.ts";
import { planSupport } from "./support.ts";

/** One planner and how often it runs. `offset` staggers the first run, so planners spread over ticks. */
export interface Slot {
  name: PlannerName;
  every: number;
  offset: number;
  run: Planner;
}

/** Run order matters: base sets the site the others read; army sets the squads that artillery and support follow. */
export const SCHEDULE: readonly Slot[] = [
  { name: "base", every: 20, offset: 0, run: planBase },
  { name: "economy", every: 10, offset: 0, run: planEconomy },
  { name: "production", every: 10, offset: 3, run: planProduction },
  { name: "army", every: 5, offset: 1, run: planArmy },
  { name: "artillery", every: 5, offset: 2, run: planArtillery },
  { name: "support", every: 10, offset: 6, run: planSupport },
];

/** Due when its period has passed since the last run. Before the first run, due from its offset. */
export function isDue(slot: Slot, last: number, tick: number): boolean {
  return last < 0 ? tick >= slot.offset : tick - last >= slot.every;
}
