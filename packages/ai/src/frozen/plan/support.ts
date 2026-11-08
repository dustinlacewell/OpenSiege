import type { MapSize, Unit } from "@mf/sim";
import { clampPoint, within, type Point } from "../geometry.ts";
import { ENGINEER_REACH } from "../plans/asks/buildSpeed.ts";
import type { Assign } from "../tasks.ts";
import { anchorBehind, inDanger, mainSquad, withChoices } from "./escort.ts";
import { anchored, follow, type Choice } from "./follow.ts";
import type { Plan, PlanResult } from "./plan.ts";

/** The radar truck trails the squad centre by this much. */
const BEHIND = 800;
/** The truck deploys this close to its anchor. */
const AT_ANCHOR = 600;
/** A deployed truck stays until its anchor is this far away. */
const LEASH = 2000;
/** With a squad out, engineers past this many stay home with the factory. */
const SQUAD_ENGINEERS = 2;
/** Engineers at a factory stand on a ring this far round it. */
const ENGINEER_RING = 250;
/** An engineer's goto is done this close to its ring spot, so it sieges inside the work reach of the factory, with a margin. */
const ENGINEER_ARRIVE = ENGINEER_REACH - ENGINEER_RING - 100;

/**
 * Engineers guard the main squad's lead tank; the rest siege on a ring round the factories, spread evenly, to speed
 * their builds. Radar trucks follow the squad and deploy at a safe spot behind it, or at staging.
 */
export function planSupport(p: Plan, members: readonly Readonly<Unit>[]): PlanResult {
  const main = mainSquad(p);
  const assign = engineerTasks(p, members.filter((u) => u.kind === "engineer"), main?.units[0]?.id);
  const anchor = anchorBehind(p, main?.units, BEHIND);
  const choices = new Map<number, Choice>();
  for (const r of members.filter((u) => u.kind === "radar")) {
    const wantStay = within(r, anchor, anchored(r) ? LEASH : AT_ANCHOR) && !inDanger(p, r);
    const f = follow(anchor, wantStay, p.mem.modeSince.get(r.id), p.pic.tick);
    assign.push({ unit: r.id, task: f.task });
    choices.set(r.id, f.choice);
  }
  return { assign, intents: [], memory: { modeSince: withChoices(p, choices) } };
}

/** The first SQUAD_ENGINEERS guard the lead, if there is one. The k-th of the rest sieges at factory k mod n. */
function engineerTasks(p: Plan, engineers: readonly Readonly<Unit>[], lead: number | undefined): Assign[] {
  const squad = lead === undefined ? [] : engineers.slice(0, SQUAD_ENGINEERS);
  const home = engineers.slice(squad.length);
  const factories = p.pic.mine.factory;
  const assign: Assign[] = squad.map((e) => ({ unit: e.id, task: { t: "guard", target: lead! } }));
  if (factories.length === 0) return assign;
  home.forEach((e, k) => {
    const spot = ringSpot(factories[k % factories.length]!, Math.floor(k / factories.length), p.pic.map);
    assign.push({ unit: e.id, task: { t: "goto", ...spot, attack: false, siege: true, arrive: ENGINEER_ARRIVE } });
  });
  return assign;
}

/** The n-th engineer spot on the ring round factory `f`. */
function ringSpot(f: Point, n: number, m: MapSize): Point {
  const a = n * 2.4 + 0.5;
  return clampPoint({ x: f.x + Math.cos(a) * ENGINEER_RING, y: f.y + Math.sin(a) * ENGINEER_RING }, m);
}
