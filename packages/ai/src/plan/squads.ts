import type { Unit } from "@mf/sim";
import { deployedPowerWithin, sumPower } from "../assess/power.ts";
import { BASE_AREA, type Raid } from "./raid.ts";
import { centroid, clampPoint, dist2, spread, within, type Point } from "../geometry.ts";
import type { Squad } from "../memory/memory.ts";
import type { Plan } from "./plan.ts";
import { enemyPowerAt, pickTarget, scoutPoint, TARGET_REACH } from "./targets.ts";

/** Share of the artillery's deployed power that backs a squad. The guns follow the main squad (`plan/artillery.ts`). */
export const GUN_SHARE = 0.6;
/** Guns this close to a squad back it. */
const GUN_REACH = 2200;
/** Enemy power within this of a squad counts against it. */
const LOCAL = 1500;
/** Strung out past this, the squad gathers; tight within this, it goes on. */
const STRUNG = 1400;
const TIGHT = 700;
/** Ticks a gather may last. */
const GATHER_MAX = 300;
/** The squad centre this close to its goal is there. */
const ARRIVED = 600;
/** A retreat this close to staging is over: the tanks rejoin the pool. */
const HOME = 900;

/** The living members of a squad, in id order. */
export function membersOf(s: Squad, byId: ReadonlyMap<number, Readonly<Unit>>): Readonly<Unit>[] {
  return s.members.map((id) => byId.get(id)).filter((u): u is Readonly<Unit> => u !== undefined);
}

export function prune(s: Squad, byId: ReadonlyMap<number, Readonly<Unit>>): Squad {
  return { ...s, members: s.members.filter((id) => byId.has(id)) };
}

/**
 * One squad's next state. `null`: it is home from a retreat and dissolves into the pool.
 * Defend beats everything near the base; then retreat when outmatched; then gather when strung out; then attack.
 */
export function stepSquad(p: Plan, s: Squad, units: readonly Readonly<Unit>[], raid: Raid | undefined): Squad | null {
  const c = centroid(units, p.pic.map);
  const power = sumPower(units) + GUN_SHARE * deployedPowerWithin(p.pic.mine.artillery, c, GUN_REACH);
  if (raid && within(c, p.home.site, BASE_AREA)) return { ...s, state: "defend", goal: clampPoint(raid.at, p.pic.map) };
  if (s.state === "defend") return retreat(p, s);
  if (s.state !== "retreat" && power < p.knobs.retreatRatio * enemyPowerAt(p, c, LOCAL)) return retreat(p, s);
  if (s.state === "retreat") return within(c, p.home.staging, HOME) ? null : s;
  if (s.state === "gather") return spread(units, c) <= TIGHT || p.pic.tick - s.since > GATHER_MAX ? { ...s, state: "attack", goal: s.target } : s;
  if (spread(units, c) > STRUNG) return gather(p, s, units);
  return advance(p, s, c, power);
}

function retreat(p: Plan, s: Squad): Squad {
  return { ...s, state: "retreat", goal: p.home.staging, since: p.pic.tick };
}

/** Meet at the member nearest the target. */
function gather(p: Plan, s: Squad, units: readonly Readonly<Unit>[]): Squad {
  const lead = units.reduce((a, b) => (dist2(b, s.target) < dist2(a, s.target) ? b : a));
  return { ...s, state: "gather", goal: clampPoint(lead, p.pic.map), since: p.pic.tick };
}

/** Keep the target while it stands. Retarget on arrival, when a scout finds a target, or when the target is gone. */
function advance(p: Plan, s: Squad, c: Point, power: number): Squad {
  const arrived = within(c, s.goal, ARRIVED);
  const targetGone = !s.scouting && !p.groups.some((g) => within(g.at, s.target, TARGET_REACH));
  if (!arrived && !targetGone && !s.scouting) return s;
  const t = pickTarget(p, c, power, s.k);
  if (t) {
    const at = clampPoint(t.at, p.pic.map);
    return { ...s, state: "attack", goal: at, target: at, scouting: false };
  }
  if (!arrived && !targetGone) return s;
  const at = scoutPoint(p, c);
  return { ...s, state: "attack", goal: at, target: at, scouting: true };
}
