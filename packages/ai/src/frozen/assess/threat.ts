import { UNIT_STATS, type MapSize } from "@mf/sim";
import type { Point } from "../geometry.ts";
import type { Ghost } from "../memory/memory.ts";
import { ghostPower } from "./power.ts";

/** Threat cells are this many world units on a side. */
const CELL = 400;
/** A mobile enemy can close this far before the bot reacts again. */
const MOBILE_MARGIN = 400;
/** Reach of an enemy of unknown kind: a tank's range. */
const UNKNOWN_RANGE = UNIT_STATS.tank.range;

/** Remembered enemy power, stamped over every cell the enemy can hit. Row-major `cells[j * cols + i]`. */
export interface ThreatMap {
  cols: number;
  rows: number;
  cells: readonly number[];
}

export function buildThreat(ghosts: readonly Ghost[], m: MapSize): ThreatMap {
  const cols = Math.ceil(m.width / CELL);
  const rows = Math.ceil(m.height / CELL);
  const cells = new Array<number>(cols * rows).fill(0);
  for (const g of ghosts) {
    const power = ghostPower(g);
    if (power > 0) stamp(cells, cols, rows, g, reachOf(g), power);
  }
  return { cols, rows, cells };
}

/** How far a ghost can hurt: its weapon range for its mode, plus a margin if it can drive. */
export function reachOf(g: Ghost): number {
  if (!g.kind) return UNKNOWN_RANGE + MOBILE_MARGIN;
  const s = UNIT_STATS[g.kind];
  const anchored = g.mode === "sieged" || g.mode === "deploying";
  return anchored ? s.siegeRange : s.range + MOBILE_MARGIN;
}

function stamp(cells: number[], cols: number, rows: number, at: Point, reach: number, power: number): void {
  const lo = (v: number): number => Math.max(0, Math.floor((v - reach) / CELL));
  const hiX = Math.min(cols - 1, Math.floor((at.x + reach) / CELL));
  const hiY = Math.min(rows - 1, Math.floor((at.y + reach) / CELL));
  for (let j = lo(at.y); j <= hiY; j++) {
    for (let i = lo(at.x); i <= hiX; i++) {
      const cx = i * CELL + CELL / 2;
      const cy = j * CELL + CELL / 2;
      if ((cx - at.x) ** 2 + (cy - at.y) ** 2 <= reach * reach) cells[j * cols + i]! += power;
    }
  }
}

/** Enemy power that can reach the point. */
export function threatAt(map: ThreatMap, p: Point): number {
  const i = Math.min(map.cols - 1, Math.max(0, Math.floor(p.x / CELL)));
  const j = Math.min(map.rows - 1, Math.max(0, Math.floor(p.y / CELL)));
  return map.cells[j * map.cols + i] ?? 0;
}

export function safe(map: ThreatMap, p: Point, limit: number): boolean {
  return threatAt(map, p) <= limit;
}
