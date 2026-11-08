import type { Point } from "../geometry.ts";
import { centreOf } from "./grid.ts";
import type { MapStudy } from "./study.ts";

/** Half the band's width across `dir`, as a fraction of the range. */
const BAND_HALF_WIDTH = 0.5;
/** The band runs from the range out to this many times the range, along `dir`. */
const BAND_FAR = 1.5;

/**
 * The range a shooter on `cell` gains over targets ahead along `dir` (a unit vector), by the sim's rule
 * (`weapons.ts` `effectiveRange`): the cell's height above the mean height of the passable cells in the band
 * from `range` to `range * 1.5` ahead, capped at `range / 2`. 0 when the band holds no passable cell.
 */
export function heightEdge(study: MapStudy, cell: number, dir: Point, range: number): number {
  const ground = bandMean(study, centreOf(study, cell), dir, range);
  if (ground === undefined) return 0;
  return Math.min(range / 2, Math.max(0, study.height[cell]! - ground));
}

function bandMean(study: MapStudy, from: Point, dir: Point, range: number): number | undefined {
  const far = range * BAND_FAR, half = range * BAND_HALF_WIDTH, reach = Math.hypot(far, half);
  const i0 = Math.max(0, Math.floor((from.x - reach) / study.cell)), i1 = Math.min(study.cols - 1, Math.floor((from.x + reach) / study.cell));
  const j0 = Math.max(0, Math.floor((from.y - reach) / study.cell)), j1 = Math.min(study.rows - 1, Math.floor((from.y + reach) / study.cell));
  let sum = 0, count = 0;
  for (let j = j0; j <= j1; j++) {
    for (let i = i0; i <= i1; i++) {
      const c = j * study.cols + i;
      if (!study.passable[c]) continue;
      const p = centreOf(study, c), dx = p.x - from.x, dy = p.y - from.y;
      const along = dx * dir.x + dy * dir.y, across = dx * dir.y - dy * dir.x;
      if (along < range || along > far || Math.abs(across) > half) continue;
      sum += study.height[c]!;
      count++;
    }
  }
  return count > 0 ? sum / count : undefined;
}
