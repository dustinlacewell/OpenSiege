import { UNIT_STATS, type Unit } from "@mf/sim";
import { within } from "../geometry.ts";
import type { Assign } from "../tasks.ts";
import { anchorBehind, inDanger, mainSquad, withChoices } from "./escort.ts";
import { anchored, follow, type Choice } from "./follow.ts";
import type { Plan, PlanResult } from "./plan.ts";

/** Artillery trails the squad centre by this much. */
const BEHIND = 500;
/** A known enemy inside this share of the siege range is worth deploying for. */
const IN_RANGE = 0.9;
/** Deployed artillery this far from its anchor packs and follows, unless it has a target. */
const LEASH = 2500;
/** With no squad, artillery deploys this close to staging. */
const AT_HOME = 700;

/** Each gun follows the main squad, deploys when a known enemy is in range and its spot is not in danger, and packs to follow when the squad moves on. Home guns deploy at staging. */
export function planArtillery(p: Plan, guns: readonly Readonly<Unit>[]): PlanResult {
  const main = mainSquad(p);
  const anchor = anchorBehind(p, main?.units, BEHIND);
  const reach = UNIT_STATS.artillery.siegeRange * IN_RANGE;
  const assign: Assign[] = [];
  const choices = new Map<number, Choice>();
  for (const a of guns) {
    const target = p.known.some((g) => within(g, a, reach));
    const danger = inDanger(p, a);
    const leashed = !main || within(a, anchor, LEASH);
    const home = !main && within(a, anchor, AT_HOME);
    const wantStay = anchored(a) ? (target && leashed) || home || (danger && target) : (target && leashed && !danger) || home;
    const r = follow(anchor, wantStay, p.mem.modeSince.get(a.id), p.pic.tick);
    assign.push({ unit: a.id, task: r.task });
    choices.set(a.id, r.choice);
  }
  return { assign, intents: [], memory: { modeSince: withChoices(p, choices) } };
}
