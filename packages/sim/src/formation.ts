import { UNIT_STATS } from "./stats.ts";
import { isqrt } from "./math.ts";
import { clampX, clampY } from "./mapSize.ts";
import type { MapSize, Unit } from "./types.ts";

/** A point for one unit of a move order: where it starts the leg, or its destination spot. */
export interface Spot {
  unit: Unit;
  x: number;
  y: number;
}

/** Unit axis vectors are scaled to this length. */
const AXIS = 1024;
/** Space between unit bodies in a formation, on top of the widest body. */
const GAP = 40;

interface Axes {
  fx: number;
  fy: number;
}

/**
 * A grid of spots centered on (x, y), wider than deep, facing from the group's
 * centroid to the click. `from` holds where each unit starts the leg. Units pair
 * with spots by rank along and across that direction, so neighbours stay
 * neighbours and paths do not cross.
 */
export function assignSpots(from: readonly Spot[], x: number, y: number, m: MapSize): Spot[] {
  if (from.length === 0) return [];
  if (from.length === 1) return [{ unit: from[0]!.unit, x: clampX(m, x), y: clampY(m, y) }];
  const axes = forwardAxis(from, x, y);
  const cols = columnsFor(from.length);
  const rows = rankUnits(from, axes, cols);
  const spacing = 2 * widestRadius(from) + GAP;
  return placeRows(rows, axes, spacing, x, y, m);
}

/** ceil(sqrt(2n)): about twice as wide as deep. */
function columnsFor(n: number): number {
  const c = isqrt(2 * n);
  return c * c < 2 * n ? c + 1 : c;
}

function widestRadius(from: readonly Spot[]): number {
  let r = 0;
  for (const s of from) r = Math.max(r, UNIT_STATS[s.unit.kind].radius);
  return r;
}

/** Centroid to click, as an integer vector. +y when the click sits on the centroid. */
function forwardAxis(from: readonly Spot[], x: number, y: number): Axes {
  let sx = 0, sy = 0;
  for (const s of from) {
    sx += s.x;
    sy += s.y;
  }
  const fx = x - Math.floor(sx / from.length);
  const fy = y - Math.floor(sy / from.length);
  return fx === 0 && fy === 0 ? { fx: 0, fy: 1 } : { fx, fy };
}

/** Front-first rows of `cols` units; each row ordered along the side axis. Ties by id. */
function rankUnits(from: readonly Spot[], a: Axes, cols: number): Unit[][] {
  const forward = (s: Spot) => s.x * a.fx + s.y * a.fy;
  const side = (s: Spot) => s.x * -a.fy + s.y * a.fx;
  const sorted = [...from].sort((p, q) => forward(q) - forward(p) || p.unit.id - q.unit.id);
  const rows: Unit[][] = [];
  for (let i = 0; i < sorted.length; i += cols) {
    const row = sorted.slice(i, i + cols).sort((p, q) => side(p) - side(q) || p.unit.id - q.unit.id);
    rows.push(row.map((s) => s.unit));
  }
  return rows;
}

/** Row 0 is the front. Each row, the short last one too, is centered on the click. */
function placeRows(rows: Unit[][], a: Axes, spacing: number, x: number, y: number, m: MapSize): Spot[] {
  const len = isqrt(a.fx * a.fx + a.fy * a.fy) || 1;
  const ax = Math.floor((a.fx * AXIS) / len), ay = Math.floor((a.fy * AXIS) / len);
  const out: Spot[] = [];
  rows.forEach((row, r) => {
    // Offsets are doubled so a centered grid stays on integers.
    const along2 = (rows.length - 1 - 2 * r) * spacing;
    row.forEach((unit, c) => {
      const across2 = (2 * c - (row.length - 1)) * spacing;
      out.push({
        unit,
        x: clampX(m, x + Math.floor((ax * along2 - ay * across2) / (2 * AXIS))),
        y: clampY(m, y + Math.floor((ay * along2 + ax * across2) / (2 * AXIS))),
      });
    });
  });
  return out;
}
