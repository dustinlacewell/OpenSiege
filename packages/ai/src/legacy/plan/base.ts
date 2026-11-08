import type { Intent, MapSize, ResourceField, Unit } from "@mf/sim";
import { powerWithin } from "../assess/power.ts";
import { threatAt } from "../assess/threat.ts";
import { clampPoint, dist, toward, within, type Point } from "../geometry.ts";
import type { Assign } from "../tasks.ts";
import { homeOf, type Plan, type PlanResult } from "./plan.ts";

/** Fields within this of the site count as its wealth. */
const WEALTH_REACH = 4500;
/** Below this wealth the site is running dry. */
const LOW_WEALTH = 3000;
/** A new site must be this many times richer, plus the floor. */
const BETTER = 2;
const BETTER_FLOOR = 1000;
/** Ticks the factory stays at a site before it may move again. */
const DWELL = 1500;
/** The factory stands this far from the field it moves to, on the side it comes from. */
const BESIDE_FIELD = 700;
/** Shelled: enemy power on the site is this times the own power there, and no enemy is this close. */
const SHELLED_RATIO = 2;
const OUTRANGED = 1600;
const DEFENCE_REACH = 1500;
const FLEE = 2500;
/** Extra factories stand on a ring this far round the site. */
const RING = 450;
/** A factory this close to its spot is there. */
const AT_SPOT = 250;
/** A rally this far from the staging spot is moved. */
const RALLY_SLACK = 100;

/** Keeps the factories deployed at the site, moves the site when it runs dry or gets shelled, and keeps the rally on the staging spot. */
export function planBase(p: Plan): PlanResult {
  const factories = p.pic.mine.factory;
  const main = factories[0];
  if (!main) return { assign: [], intents: [], memory: {} };
  const site = chooseSite(p, main);
  const moved = !p.mem.site || site.x !== p.mem.site.x || site.y !== p.mem.site.y;
  const staging = homeOf(p.pic, { ...p.mem, site }).staging;
  return {
    assign: factories.map((f, n) => standAt(f, spotOf(site, n, p.pic.map))),
    intents: rally(factories, staging),
    memory: { site, siteSince: moved ? p.pic.tick : p.mem.siteSince },
  };
}

function chooseSite(p: Plan, main: Readonly<Unit>): Point {
  const here = p.mem.site ?? clampPoint(main, p.pic.map);
  if (!p.mem.site || p.pic.tick - p.mem.siteSince < DWELL) return here;
  return fleeShelling(p, here) ?? richerSite(p, here) ?? here;
}

/** Long-range fire the defence cannot answer: step away from it. */
function fleeShelling(p: Plan, here: Point): Point | undefined {
  const threat = threatAt(p.threat, here);
  if (threat <= SHELLED_RATIO * powerWithin(p.pic.own, here, DEFENCE_REACH)) return undefined;
  const near = p.known.filter((g) => within(g, here, FLEE + OUTRANGED));
  if (near.length === 0 || near.some((g) => within(g, here, OUTRANGED))) return undefined;
  const from = near.reduce((s, g) => ({ x: s.x + g.x / near.length, y: s.y + g.y / near.length }), { x: 0, y: 0 });
  const away = toward(here, from, -FLEE, p.pic.map);
  return threatAt(p.threat, away) < threat ? away : undefined;
}

function richerSite(p: Plan, here: Point): Point | undefined {
  const now = wealth(p.pic.fields, here);
  if (now >= LOW_WEALTH) return undefined;
  let best: Point | undefined;
  let bestWealth = now * BETTER + BETTER_FLOOR;
  for (const f of p.pic.fields) {
    const spot = toward(f, here, BESIDE_FIELD, p.pic.map);
    const w = wealth(p.pic.fields, spot) - dist(here, spot) / 4;
    if (w > bestWealth && threatAt(p.threat, spot) === 0) {
      bestWealth = w;
      best = spot;
    }
  }
  return best;
}

function wealth(fields: readonly Readonly<ResourceField>[], at: Point): number {
  let s = 0;
  for (const f of fields) if (within(f, at, WEALTH_REACH)) s += f.amount;
  return s;
}

/** The main factory stands on the site; the n-th extra one on a ring round it. */
function spotOf(site: Point, n: number, m: MapSize): Point {
  if (n === 0) return site;
  const a = (n - 1) * 2.1 + 1;
  return clampPoint({ x: site.x + Math.cos(a) * RING, y: site.y + Math.sin(a) * RING }, m);
}

function standAt(f: Readonly<Unit>, spot: Point): Assign {
  if (within(f, spot, AT_SPOT)) return { unit: f.id, task: { t: "siege", on: true } };
  return { unit: f.id, task: { t: "goto", ...spot, attack: false, siege: true } };
}

/** One rally intent for every factory whose rally is off the staging spot. A factory move clears its rally, so this also heals that. */
function rally(factories: readonly Readonly<Unit>[], staging: Point): Intent[] {
  const off = factories.filter((f) => !f.rally || !within(f.rally, staging, RALLY_SLACK)).map((f) => f.id);
  return off.length > 0 ? [{ t: "rally", units: off, x: staging.x, y: staging.y }] : [];
}
