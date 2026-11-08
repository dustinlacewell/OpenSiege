import { UNIT_STATS, type Intent, type MapSize, type Unit } from "@mf/sim";
import { powerWithin, unitPower } from "../assess/power.ts";
import { threatAt } from "../assess/threat.ts";
import { dangerAlong, safestNear } from "../danger/query.ts";
import { clampPoint, dist, toward, within, type Point } from "../geometry.ts";
import type { Assign } from "../tasks.ts";
import { frontOf } from "./front.ts";
import { holdSpot } from "../terrain/hold.ts";
import { defaultStaging, type Plan, type PlanResult } from "./plan.ts";

/** Ticks the factory stays at a site before it may move again. */
const DWELL = 1500;
/** Shelled: enemy power on the site is this times the own power there, and no enemy is this close. */
const SHELLED_RATIO = 2;
const OUTRANGED = 1600;
const DEFENCE_REACH = 1500;
const FLEE = 2500;
/** The factory stands this far behind the front: out of artillery reach, with a margin. */
const BACKSET = UNIT_STATS.artillery.siegeRange + 800;
/** How far round the wanted spot the factory looks for a safer one. */
const SEARCH = 1200;
/** Distance per unit of danger when the search weighs a cell: 1000 of distance counts as one tank's power. */
const DIST_SCALE = 1000 / unitPower("tank", "mobile");
/** The factory moves only to a spot farther than this from where it stands. Small front shifts do not move it. */
const MOVE_SLACK = 2000;
/** The most danger the straight road to a new spot may cross: half a tank's power. */
const ROAD_SAFE = unitPower("tank", "mobile") / 2;
/** Extra factories stand on a ring this far round the site. */
const RING = 450;
/** A factory this close to its spot is there. */
const AT_SPOT = 250;
/** A rally this far from the staging spot is moved. */
const RALLY_SLACK = 100;

/** Keeps the factories deployed at the site, moves the site off shelling or behind the front, and keeps the rally on the staging spot. */
export function planBase(p: Plan, factories: readonly Readonly<Unit>[]): PlanResult {
  const main = factories[0];
  if (!main) return { assign: [], intents: [], memory: {} };
  const front = frontOf(p) ?? null;
  const site = chooseSite(p, main, front);
  const moved = !p.mem.site || site.x !== p.mem.site.x || site.y !== p.mem.site.y;
  const staging = stagingOf(p, site, front);
  return {
    assign: factories.map((f, n) => standAt(f, spotOf(site, n, p.pic.map))),
    intents: rally(factories, staging),
    memory: { site, siteSince: moved ? p.pic.tick : p.mem.siteSince, front, staging },
  };
}

/** The hold spot on the road to the front (`terrain/hold.ts`), or the default rule with no front or no spot. */
function stagingOf(p: Plan, site: Point, front: Point | null): Point {
  const held = front ? holdSpot(p.board.study, site, front) : undefined;
  return held ? clampPoint(held, p.pic.map) : defaultStaging(site, front, p.pic.map);
}

function chooseSite(p: Plan, main: Readonly<Unit>, front: Point | null): Point {
  const here = p.mem.site ?? clampPoint(main, p.pic.map);
  if (!p.mem.site || p.pic.tick - p.mem.siteSince < DWELL) return here;
  return fleeShelling(p, here) ?? anchorSite(p, here, front) ?? here;
}

/** Stand BACKSET behind the front, on the line back to here, on the safest cell near that spot. Only a long, safe move counts. */
function anchorSite(p: Plan, here: Point, front: Point | null): Point | undefined {
  if (!front) return undefined;
  const wanted = toward(here, front, dist(here, front) - BACKSET, p.pic.map);
  const spot = safestNear(p.board.danger, p.pic.map, wanted, SEARCH, (cell) => -dist(cell, wanted) / DIST_SCALE);
  if (!spot || within(spot, here, MOVE_SLACK)) return undefined;
  return dangerAlong(p.board.danger, here, spot) <= ROAD_SAFE ? clampPoint(spot, p.pic.map) : undefined;
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
