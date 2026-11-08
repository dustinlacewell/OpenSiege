import type { Grid } from "./grid.ts";
import { clearLine } from "./lineOfSight.ts";
import { dist2 } from "./math.ts";
import { UNIT_STATS } from "./stats.ts";
import { sameTeam, teamOf } from "./teams.ts";
import { heightAt } from "./terrain.ts";
import type { Unit, World } from "./types.ts";
import { jamRange, radarRange } from "./units.ts";

/**
 * What a team knows of a unit. seen: some teammate's unit has it in sight and a clear line.
 * radar: in some teammate's radar range, and not within the jam range of a unit on its own team. none: nothing.
 */
export type Level = "seen" | "radar" | "none";

/** The one rule for what a team knows of a unit. Pure: reads the world, never writes it, not part of the state hash. */
export interface Detection {
  /** What player `viewer`'s team knows of unit `u`. Own and allied units are "seen". */
  level(viewer: number, u: Unit): Level;
  /** level(viewer, u) !== "none". */
  detects(viewer: number, u: Unit): boolean;
}

/** Detects every unit as "seen". Only for a mine: it hits by contact, so it needs no detection. */
export const everything: Detection = { level: () => "seen", detects: () => true };

/** The detection `u` picks and keeps targets by: `everything` for a mine, else its team's `seen`. */
export function detectionFor(u: Unit, seen: Detection): Detection {
  return UNIT_STATS[u.kind].weapon === "mine" ? everything : seen;
}

/** What classification reads of one unit, copied when `detect` is built. */
type Snap = Pick<Unit, "id" | "owner" | "kind" | "mode" | "x" | "y" | "hp">;

/**
 * Detection over `world` as it is at the call. `grid` is `buildGrid(world.units, mapSize(world.terrain))`, built at the same moment.
 * Every unit's id, owner, kind, mode, position and hp is copied now; classification reads only that copy, for the viewers
 * and for the queried unit, so later moves and deaths in the tick do not change an answer. A unit not in the copy (spawned later) is "none"
 * unless own or allied. Terrain is read live: nothing before `projectiles` changes it.
 * Lazy: a unit is classified the first time a team asks, then memoised.
 */
export function detect(world: World, grid: Grid): Detection {
  const reach = longestReach();
  const snaps = world.units.map(snapOf);
  const byId = new Map(snaps.map((s, i) => [s.id, i]));
  const memo = new Map<number, Map<number, Level>>();
  const near: number[] = [];

  function level(viewer: number, u: Unit): Level {
    if (sameTeam(world.players, viewer, u.owner)) return "seen";
    const known = teamMemo(memo, teamOf(world.players, viewer));
    let lvl = known.get(u.id);
    if (lvl === undefined) known.set(u.id, (lvl = classifyId(u.id, viewer)));
    return lvl;
  }

  function classifyId(id: number, viewer: number): Level {
    const i = byId.get(id);
    if (i === undefined) return "none";
    const t = snaps[i]!;
    return classify(world, snaps, grid.query(t.x, t.y, reach, near), viewer, t);
  }

  return { level, detects: (viewer, u) => level(viewer, u) !== "none" };
}

function snapOf(u: Unit): Snap {
  return { id: u.id, owner: u.owner, kind: u.kind, mode: u.mode, x: u.x, y: u.y, hp: u.hp };
}

/** Largest sight, radar or jam of any kind: the grid query radius that finds every possible viewer and jammer. */
function longestReach(): number {
  let r = 0;
  for (const s of Object.values(UNIT_STATS)) r = Math.max(r, s.sight, s.radar, s.siegeRadar, s.jam, s.siegeJam);
  return r;
}

function teamMemo(memo: Map<number, Map<number, Level>>, team: number): Map<number, Level> {
  let m = memo.get(team);
  if (!m) memo.set(team, (m = new Map()));
  return m;
}

/**
 * Seen if some living teammate's unit in `near` (indices into `snaps`) has `u` in sight and a clear line to its top,
 * else radar if in some radar range and not jammed.
 */
function classify(world: World, snaps: readonly Snap[], near: readonly number[], viewer: number, u: Snap): Level {
  if (u.mode === "sieged" && UNIT_STATS[u.kind].siegeHidden) return "none";
  let lvl: Level = "none";
  for (const i of near) {
    const v = snaps[i]!;
    if (v.hp <= 0 || !sameTeam(world.players, viewer, v.owner)) continue;
    const d2 = dist2(v.x, v.y, u.x, u.y);
    const sight = UNIT_STATS[v.kind].sight;
    if (d2 <= sight * sight && sees(world, v, u)) return "seen";
    const radar = radarRange(v);
    if (d2 <= radar * radar) lvl = "radar";
  }
  return lvl === "radar" && jammed(world, snaps, near, u) ? "none" : lvl;
}

/** Some living unit in `near` on `u`'s own team has `u` within its `jamRange`. A jammer jams itself. */
function jammed(world: World, snaps: readonly Snap[], near: readonly number[], u: Snap): boolean {
  for (const i of near) {
    const j = snaps[i]!;
    if (j.hp <= 0 || !sameTeam(world.players, u.owner, j.owner)) continue;
    const jam = jamRange(j);
    if (jam > 0 && dist2(j.x, j.y, u.x, u.y) <= jam * jam) return true;
  }
  return false;
}

/** Clear terrain line from `v`'s eye to `u`'s top. Both are ground height plus model height. */
function sees(world: World, v: Snap, u: Snap): boolean {
  const t = world.terrain;
  const eye = heightAt(t, v.x, v.y) + UNIT_STATS[v.kind].height;
  const top = heightAt(t, u.x, u.y) + UNIT_STATS[u.kind].height;
  return clearLine(t, v.x, v.y, eye, u.x, u.y, top);
}
