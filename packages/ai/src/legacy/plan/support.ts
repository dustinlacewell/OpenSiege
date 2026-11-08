import { within } from "../geometry.ts";
import type { Assign } from "../tasks.ts";
import { anchorBehind, inDanger, mainSquad, withChoices } from "./escort.ts";
import { anchored, follow, type Choice } from "./follow.ts";
import { mainFactory, type Plan, type PlanResult } from "./plan.ts";

/** The radar truck trails the squad centre by this much. */
const BEHIND = 800;
/** The truck deploys this close to its anchor. */
const AT_ANCHOR = 600;
/** A deployed truck stays until its anchor is this far away. */
const LEASH = 2000;
/** With a squad out, engineers past this many stay home with the factory. */
const SQUAD_ENGINEERS = 2;

/** Engineers guard the main squad's lead tank, or the factory. Radar trucks follow the squad and deploy at a safe spot behind it, or at staging. */
export function planSupport(p: Plan): PlanResult {
  const main = mainSquad(p);
  const lead = main?.units[0]?.id;
  const factory = mainFactory(p.pic)?.id;
  const assign: Assign[] = [];
  p.pic.mine.engineer.forEach((e, n) => {
    const target = lead !== undefined && n < SQUAD_ENGINEERS ? lead : factory;
    if (target !== undefined) assign.push({ unit: e.id, task: { t: "guard", target } });
  });
  const anchor = anchorBehind(p, main?.units, BEHIND);
  const choices = new Map<number, Choice>();
  for (const r of p.pic.mine.radar) {
    const wantStay = within(r, anchor, anchored(r) ? LEASH : AT_ANCHOR) && !inDanger(p, r);
    const f = follow(anchor, wantStay, p.mem.modeSince.get(r.id), p.pic.tick);
    assign.push({ unit: r.id, task: f.task });
    choices.set(r.id, f.choice);
  }
  return { assign, intents: [], memory: { modeSince: withChoices(p, choices) } };
}
