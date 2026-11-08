import { createSimState, mapSize, type World } from "@mf/sim";
import type { Point } from "../geometry.ts";
import { flowLayer } from "./flow.ts";
import type { StudyGrid } from "./grid.ts";
import { heightLayer, passableLayer, widthLayer } from "./layers.ts";
import { terminalsOf } from "./terminals.ts";

/** World units per study cell side. */
export const STUDY_CELL = 250;

/**
 * What the bot knows of the ground, on a coarse grid. Built once per match: only craters change the terrain
 * later, and the study ignores them.
 */
export interface MapStudy extends StudyGrid {
  /** 1 where a tank (move class "light") may drive, by the sim's own nav grid. */
  passable: Uint8Array;
  /** Steps to the nearest blocked cell or the map edge. 0 on blocked cells. Low is a narrow pass. */
  width: Uint16Array;
  /** Ground height at the cell centre. */
  height: Float32Array;
  /** 0..1: how much wealth-weighted traffic between spawns and field clusters crosses the cell (`flow.ts`). */
  flow: Float32Array;
}

/** Studies the map: passable, width and height layers, then the flow between spawns and field clusters. */
export function studyMap(world: Readonly<World>): MapStudy {
  const size = mapSize(world.terrain);
  const grid: StudyGrid = { cols: Math.ceil(size.width / STUDY_CELL), rows: Math.ceil(size.height / STUDY_CELL), cell: STUDY_CELL };
  const nav = createSimState(world as World).nav;
  const passable = passableLayer(grid, { ...nav.shape, grid: nav.grids.light });
  const terminals = terminalsOf(world.fields, spawnsOf(world));
  return {
    ...grid,
    passable,
    width: widthLayer(grid, passable),
    height: heightLayer(grid, world.terrain),
    flow: flowLayer(grid, passable, terminals),
  };
}

/** Each player's first factory: where the players start. */
function spawnsOf(world: Readonly<World>): Point[] {
  const seen = new Set<number>();
  const out: Point[] = [];
  for (const u of world.units) {
    if (u.kind !== "factory" || seen.has(u.owner)) continue;
    seen.add(u.owner);
    out.push({ x: u.x, y: u.y });
  }
  return out;
}
