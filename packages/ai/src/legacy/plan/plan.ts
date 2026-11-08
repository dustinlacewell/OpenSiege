import { mapCentre, type Intent, type Unit } from "@mf/sim";
import type { EnemyGroup } from "../assess/groups.ts";
import type { ThreatMap } from "../assess/threat.ts";
import { toward, type Point } from "../geometry.ts";
import type { Knobs } from "../knobs.ts";
import type { Ghost, Memory } from "../memory/memory.ts";
import type { Picture } from "../perception/picture.ts";
import type { Roll } from "../rng.ts";
import type { Assign } from "../tasks.ts";

/** How far the staging spot sits from the factory site, toward the map centre. */
const STAGING_GAP = 700;

/** Where the bot lives: the main factory site, and the staging spot where new units gather. */
export interface Home {
  site: Point;
  staging: Point;
}

/** Everything a planner reads. Plain data plus the injected roll. */
export interface Plan {
  pic: Picture;
  mem: Memory;
  knobs: Knobs;
  roll: Roll;
  /** Ghosts old enough to react to. */
  known: readonly Ghost[];
  threat: ThreatMap;
  groups: readonly EnemyGroup[];
  home: Home;
}

/** What a planner returns: unit tasks, direct intents (build, rally) and the memory slices it owns. */
export interface PlanResult {
  assign: Assign[];
  intents: Intent[];
  memory: Partial<Memory>;
}

export type Planner = (p: Plan) => PlanResult;

export function homeOf(pic: Picture, mem: Memory): Home {
  const centre = mapCentre(pic.map);
  const site = mem.site ?? mainFactory(pic) ?? pic.own[0] ?? centre;
  return { site: { x: site.x, y: site.y }, staging: toward(site, centre, STAGING_GAP, pic.map) };
}

/** The oldest living factory. The base planner keeps it at the site. */
export function mainFactory(pic: Picture): Readonly<Unit> | undefined {
  return pic.mine.factory[0];
}

/** Own units by id, for planners that hold ids in memory. */
export function unitsById(pic: Picture): Map<number, Readonly<Unit>> {
  return new Map(pic.own.map((u) => [u.id, u]));
}
