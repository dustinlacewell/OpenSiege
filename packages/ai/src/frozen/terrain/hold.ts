import { UNIT_STATS } from "@mf/sim";
import { dist, type Point } from "../geometry.ts";
import { heightEdge } from "./edge.ts";
import { centreOf } from "./grid.ts";
import { studyCells } from "./path.ts";
import type { MapStudy } from "./study.ts";

/** The held line stands at least this far along the road from the site. */
const HOLD_NEAR = 500;
/** And at most this far along the road from the site. */
const HOLD_FAR = 3000;
/** And no farther than this share of the road to the front, so it stays on our side. */
const HOLD_SHARE = 0.6;
/** The range a sieged tank holds the line at. Height edge is measured over it. */
const HOLD_RANGE = UNIT_STATS.tank.siegeRange;
/** Weight of the cell's flow (0..1): a busy road is the one to block. */
const FLOW_W = 1;
/** Weight of the height edge over targets toward the front, as a share of the tank's range (0..0.5). */
const EDGE_W = 1;
/** Weight of the cell's width, as a share of the widest candidate (0..1). Wider ground is harder to hold. */
const WIDTH_W = 1;

/**
 * Where the idle tanks hold the line: the best cell on the study road from the site to the front, between
 * `HOLD_NEAR` and `min(HOLD_FAR, HOLD_SHARE` of the road`)` from the site. A cell scores for flow and for height
 * edge facing the front, and loses for width. undefined when the road is too short or there is none.
 */
export function holdSpot(study: MapStudy, site: Point, front: Point): Point | undefined {
  const road = alongRoad(study, studyCells(study, site, front));
  const far = Math.min(HOLD_FAR, HOLD_SHARE * (road.at(-1)?.along ?? 0));
  const candidates = road.filter((r) => r.along >= HOLD_NEAR && r.along <= far);
  if (candidates.length === 0) return undefined;
  const widest = Math.max(1, ...candidates.map((r) => study.width[r.cell]!));
  const score = (r: RoadCell): number =>
    study.flow[r.cell]! * FLOW_W + (heightEdge(study, r.cell, facing(r.at, front), HOLD_RANGE) / HOLD_RANGE) * EDGE_W - (study.width[r.cell]! / widest) * WIDTH_W;
  return candidates.reduce((best, r) => (score(r) > score(best) ? r : best)).at;
}

interface RoadCell {
  cell: number;
  at: Point;
  /** Road distance from the site's cell. */
  along: number;
}

function alongRoad(study: MapStudy, cells: readonly number[]): RoadCell[] {
  let along = 0;
  return cells.map((cell, n) => {
    const at = centreOf(study, cell);
    if (n > 0) along += dist(centreOf(study, cells[n - 1]!), at);
    return { cell, at, along };
  });
}

/** Unit vector from p toward the front. */
function facing(p: Point, front: Point): Point {
  const d = dist(p, front) || 1;
  return { x: (front.x - p.x) / d, y: (front.y - p.y) / d };
}
