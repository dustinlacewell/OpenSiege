import { mapCentre, type Intent, type MapSize, type Unit } from "@mf/sim";
import type { EnemyGroup } from "../assess/groups.ts";
import type { ThreatMap } from "../assess/threat.ts";
import type { Board } from "../board/board.ts";
import { toward, type Point } from "../geometry.ts";
import type { Knobs } from "../knobs.ts";
import type { Ghost, Memory } from "../memory/memory.ts";
import type { Picture } from "../perception/picture.ts";
import type { Roll } from "../rng.ts";
import type { Assign } from "../tasks.ts";

/** How far the staging spot sits from the factory site, toward the front (the map centre when none is known). */
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
  /** The board of this think. The commander step reads it; of the ported planners, economy reads its danger. */
  board: Board;
}

/** What a planner returns: unit tasks, direct intents (build, rally) and the memory slices it owns. */
export interface PlanResult {
  assign: Assign[];
  intents: Intent[];
  memory: Partial<Memory>;
}

export type Planner = (p: Plan) => PlanResult;

/** The site, and the staging spot the base plan chose, or the default rule before it chose one. */
export function homeOf(pic: Picture, mem: Memory): Home {
  const site = mem.site ?? mainFactory(pic) ?? pic.own[0] ?? mapCentre(pic.map);
  return { site: { x: site.x, y: site.y }, staging: mem.staging ?? defaultStaging(site, mem.front, pic.map) };
}

/** The default staging spot: STAGING_GAP from the site toward the front, or the map centre with no front. */
export function defaultStaging(site: Point, front: Point | null, m: MapSize): Point {
  return toward(site, front ?? mapCentre(m), STAGING_GAP, m);
}

/** The oldest living factory. The base planner keeps it at the site. */
export function mainFactory(pic: Picture): Readonly<Unit> | undefined {
  return pic.mine.factory[0];
}

/** Own units by id, for planners that hold ids in memory. */
export function unitsById(pic: Picture): Map<number, Readonly<Unit>> {
  return new Map(pic.own.map((u) => [u.id, u]));
}
