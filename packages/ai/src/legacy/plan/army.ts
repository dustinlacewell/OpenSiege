import type { Unit } from "@mf/sim";
import { deployedPowerWithin, sumPower } from "../assess/power.ts";
import { centroid, clampPoint, within, type Point } from "../geometry.ts";
import type { Squad } from "../memory/memory.ts";
import { between } from "../rng.ts";
import type { Assign, Task } from "../tasks.ts";
import { unitsById, type Plan, type PlanResult } from "./plan.ts";
import { findRaid, type Raid } from "./raid.ts";
import { GUN_SHARE, membersOf, prune, stepSquad } from "./squads.ts";
import { pickTarget, scoutPoint } from "./targets.ts";

/** A squad this close to its target fires at a seen factory or harvester on purpose, if no armed enemy is this close. */
const FOCUS = 1200;
const CLEAR = 1000;
/** Scouting stops after this tick, after this many scouts, or once an enemy factory is known. */
const SCOUT_UNTIL = 6000;
const MAX_SCOUTS = 2;
const SCOUT_ARRIVED = 500;

/** Tanks: defend raids, step each squad, send a scout, launch the pool when it is strong enough. The pool waits at staging. */
export function planArmy(p: Plan): PlanResult {
  const byId = unitsById(p.pic);
  const raid = findRaid(p);
  const squads = stepAll(p, byId, raid);
  const busy = new Set(squads.flatMap((s) => s.members));
  const scout = chooseScout(p, byId, busy);
  if (scout) busy.add(scout.id);
  let pool = p.pic.mine.tank.filter((t) => !busy.has(t.id));
  const launched = launch(p, pool, squads, raid);
  if (launched) {
    squads.push(launched);
    pool = [];
  }
  return {
    assign: [...squads.flatMap((s) => squadTasks(p, s, byId)), ...pool.map((u) => poolTask(p, u, raid)), ...(scout ? [scoutTask(scout)] : [])],
    intents: [],
    memory: {
      squads,
      nextSquad: launched ? p.mem.nextSquad + 1 : p.mem.nextSquad,
      nextK: launched ? between(p.roll, ...p.knobs.attackRatio) : p.mem.nextK,
      scout: scout?.id ?? null,
      scoutGoal: scout?.goal ?? null,
      scoutsSent: p.mem.scoutsSent + (scout && scout.id !== p.mem.scout ? 1 : 0),
    },
  };
}

function stepAll(p: Plan, byId: ReadonlyMap<number, Readonly<Unit>>, raid: Raid | undefined): Squad[] {
  const out: Squad[] = [];
  for (const s0 of p.mem.squads) {
    const s = prune(s0, byId);
    const units = membersOf(s, byId);
    if (units.length === 0) continue;
    const next = stepSquad(p, s, units, raid);
    if (next) out.push(next);
  }
  return out;
}

/** The pool becomes a squad when big enough and it beats a target by the rolled ratio, or when nothing is known and it can scout. */
function launch(p: Plan, pool: readonly Readonly<Unit>[], squads: readonly Squad[], raid: Raid | undefined): Squad | undefined {
  const active = squads.filter((s) => s.state !== "retreat").length;
  if (raid || pool.length < p.knobs.minSquad || active >= p.knobs.maxSquads) return undefined;
  const m = p.pic.map;
  const c = centroid(pool, m);
  const guns = active === 0 ? GUN_SHARE * deployedPowerWithin(p.pic.mine.artillery, c, Math.max(m.width, m.height) * 2) : 0;
  const t = pickTarget(p, c, sumPower(pool) + guns, p.mem.nextK);
  if (!t && p.groups.length > 0) return undefined;
  const goal = t ? clampPoint(t.at, m) : scoutPoint(p, c);
  return { id: p.mem.nextSquad, members: pool.map((u) => u.id), state: "attack", goal, target: goal, k: p.mem.nextK, scouting: !t, since: p.pic.tick };
}

function squadTasks(p: Plan, s: Squad, byId: ReadonlyMap<number, Readonly<Unit>>): Assign[] {
  const focus = s.state === "attack" ? focusTarget(p, centroid(membersOf(s, byId), p.pic.map), s.target) : undefined;
  const task: Task = focus !== undefined
    ? { t: "attack", target: focus }
    : { t: "goto", ...s.goal, attack: s.state !== "retreat", siege: false };
  return s.members.map((unit) => ({ unit, task }));
}

/** A seen factory or harvester near the target, with no armed enemy close: shoot it, not whatever is nearest. */
function focusTarget(p: Plan, c: Point, target: Point): number | undefined {
  if (!within(c, target, FOCUS)) return undefined;
  if (p.pic.contacts.some((e) => (e.kind === null || e.kind === "tank" || e.kind === "artillery") && within(e, c, CLEAR))) return undefined;
  const prey = p.pic.contacts.filter((e) => e.seen && (e.kind === "factory" || e.kind === "harvester") && within(e, c, FOCUS));
  prey.sort((a, b) => (a.kind === "factory" ? 0 : 1) - (b.kind === "factory" ? 0 : 1) || a.id - b.id);
  return prey[0]?.id;
}

function poolTask(p: Plan, u: Readonly<Unit>, raid: Raid | undefined): Assign {
  const at = raid ? clampPoint(raid.at, p.pic.map) : p.home.staging;
  return { unit: u.id, task: { t: "goto", ...at, attack: true, siege: false } };
}

interface Scout {
  id: number;
  goal: Point;
}

/** One free tank looks for the enemy early on. It rejoins the pool once an enemy factory is known. */
function chooseScout(p: Plan, byId: ReadonlyMap<number, Readonly<Unit>>, busy: ReadonlySet<number>): Scout | undefined {
  if (!p.knobs.scout || p.known.some((g) => g.kind === "factory")) return undefined;
  const kept = p.mem.scout !== null ? byId.get(p.mem.scout) : undefined;
  const unit = kept ?? newScout(p, busy);
  if (!unit) return undefined;
  const old = kept ? p.mem.scoutGoal : null;
  const goal = old && !within(unit, old, SCOUT_ARRIVED) ? old : scoutPoint(p, unit);
  return { id: unit.id, goal };
}

function newScout(p: Plan, busy: ReadonlySet<number>): Readonly<Unit> | undefined {
  if (p.pic.tick > SCOUT_UNTIL || p.mem.scoutsSent >= MAX_SCOUTS) return undefined;
  return p.pic.mine.tank.find((t) => !busy.has(t.id));
}

function scoutTask(s: Scout): Assign {
  return { unit: s.id, task: { t: "goto", ...s.goal, attack: false, siege: false } };
}
