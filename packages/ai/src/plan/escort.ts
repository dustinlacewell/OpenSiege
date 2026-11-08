import type { Unit } from "@mf/sim";
import { powerWithin } from "../assess/power.ts";
import { threatAt } from "../assess/threat.ts";
import { centroid, clampPoint, toward, type Point } from "../geometry.ts";
import type { Squad } from "../memory/memory.ts";
import type { Choice } from "./follow.ts";
import { unitsById, type Plan } from "./plan.ts";
import { membersOf } from "./squads.ts";

/** Own power within this counts as cover for a support unit. */
const COVER_REACH = 1200;
/** Enemy power over this times the cover is danger. */
const DANGER_RATIO = 2;

/** The squad that support units go with: the biggest one that is not retreating. */
export function mainSquad(p: Plan): { squad: Squad; units: Readonly<Unit>[] } | undefined {
  const byId = unitsById(p.pic);
  let best: { squad: Squad; units: Readonly<Unit>[] } | undefined;
  for (const squad of p.mem.squads) {
    if (squad.state === "retreat") continue;
    const units = membersOf(squad, byId);
    if (units.length > 0 && (!best || units.length > best.units.length)) best = { squad, units };
  }
  return best;
}

/** A point `behind` world units back from the squad centre, toward home. Staging with no squad. */
export function anchorBehind(p: Plan, squadUnits: readonly Readonly<Unit>[] | undefined, behind: number): Point {
  if (!squadUnits) return p.home.staging;
  return clampPoint(toward(centroid(squadUnits, p.pic.map), p.home.site, behind, p.pic.map), p.pic.map);
}

/** More enemy power can reach the point than the own units near it can answer. */
export function inDanger(p: Plan, at: Point): boolean {
  const threat = threatAt(p.threat, at);
  return threat > 0 && threat > DANGER_RATIO * powerWithin(p.pic.own, at, COVER_REACH);
}

/** `modeSince` with dead units dropped and the given choices written. */
export function withChoices(p: Plan, choices: ReadonlyMap<number, Choice>): Map<number, Choice> {
  const alive = unitsById(p.pic);
  const out = new Map([...p.mem.modeSince].filter(([id]) => alive.has(id)));
  for (const [id, c] of choices) out.set(id, c);
  return out;
}
