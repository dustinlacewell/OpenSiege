// Whether a skirmish plan can be played. Pure.
import { MAX_SEATS, teamCap, teamSizes, validTeams } from "@mf/sim";
import type { SkirmishPlan } from "./plan.ts";

/** What is wrong with `plan`, one line each. Empty when it can be played. */
export function planErrors(plan: SkirmishPlan): string[] {
  const errors: string[] = [];
  const humans = plan.seats.filter((s) => s.kind === "human").length;
  if (humans !== 1) errors.push(`need exactly one human seat, got ${humans}`);
  if (plan.seats.length > MAX_SEATS) errors.push(`at most ${MAX_SEATS} seats, got ${plan.seats.length}`);
  if (!validTeams(plan.teams)) errors.push(`bad team count ${plan.teams}`);
  else errors.push(...teamErrors(plan));
  return errors;
}

function teamErrors(plan: SkirmishPlan): string[] {
  const teams = plan.seats.map((s) => s.team);
  if (teams.some((t) => !Number.isInteger(t) || t < 0)) return ["team numbers must be integers from 0"];
  if (plan.teams === 0) return new Set(teams).size === teams.length ? [] : ["free for all needs a team number for each seat"];
  if (teams.some((t) => t >= plan.teams)) return [`team number past ${plan.teams} teams`];
  return teamSizes(teams, plan.teams).some((n) => n > teamCap(plan.teams)) ? ["a team is over its cap"] : [];
}
