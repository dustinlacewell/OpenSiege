import { UNIT_KINDS, type UnitKind } from "@mf/sim";
import type { Ghost } from "../memory/memory.ts";
import type { Plan } from "./plan.ts";

/** Artillery share of the army when the bot ignores the enemy. Too much: mobile artillery is weak. */
const BLIND_SHARE = 0.45;
/** Artillery share against an all-artillery enemy, and the extra share against an all-tank enemy. */
const COUNTER_FLOOR = 0.15;
const COUNTER_SPAN = 0.35;
/** Army size before the first engineer and the radar truck. */
const SUPPORT_FROM = 5;
const ENGINEER_EVERY = 5;
/** Army size per harvester while harvesters are still short of the target. */
const ARMY_PER_HARVESTER = 3;
/** Army size and spare credits before an extra factory. */
const FACTORY_ARMY = 6;
const FACTORY_SPARE = 400;
/** Harvesters the bot always gets first. */
const FIRST_HARVESTERS = 2;

export type Counts = Record<UnitKind, number>;

/** What the next job should be: harvesters first, then extra factories and support, then the army. */
export function nextKind(p: Plan, counts: Counts, credits: number, factoryCost: number): UnitKind {
  const army = counts.tank + counts.artillery;
  const k = p.knobs;
  if (counts.harvester < Math.min(FIRST_HARVESTERS, k.harvesterTarget)) return "harvester";
  if (counts.factory < k.factoryTarget && army >= FACTORY_ARMY && credits >= factoryCost + FACTORY_SPARE) return "factory";
  if (counts.harvester < k.harvesterTarget && army >= (counts.harvester - 1) * ARMY_PER_HARVESTER) return "harvester";
  if (army >= SUPPORT_FROM && counts.engineer < Math.min(k.engineers, Math.floor(army / ENGINEER_EVERY))) return "engineer";
  if (army >= SUPPORT_FROM && counts.radar < k.radars) return "radar";
  return armyKind(p, counts);
}

/** Tank or artillery, whichever is below its wanted share. */
function armyKind(p: Plan, counts: Counts): UnitKind {
  const share = artilleryShare(p.known, p.knobs.mixQuality);
  const army = counts.tank + counts.artillery;
  return counts.artillery < share * (army + 1) ? "artillery" : "tank";
}

/** Many enemy tanks: more artillery to shell them. Enemy artillery: more tanks to rush it. */
export function artilleryShare(known: readonly Ghost[], quality: number): number {
  let tanks = 0;
  let guns = 0;
  for (const g of known) {
    if (g.kind === "tank") tanks++;
    else if (g.kind === "artillery") guns++;
  }
  const counter = tanks + guns > 0 ? COUNTER_FLOOR + COUNTER_SPAN * (tanks / (tanks + guns)) : BLIND_SHARE;
  return BLIND_SHARE * (1 - quality) + counter * quality;
}

/** Living units plus queued jobs, per kind. */
export function countKinds(p: Plan): Counts {
  const counts = Object.fromEntries(UNIT_KINDS.map((k) => [k, p.pic.mine[k].length])) as Counts;
  for (const f of p.pic.mine.factory) for (const j of f.queue) counts[j.kind]++;
  return counts;
}
