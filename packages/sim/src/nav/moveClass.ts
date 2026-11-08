import { UNIT_KINDS, UNIT_STATS, type MoveClass } from "../stats.ts";

/** Every move class. Iterate this, never a hand-written list. */
export const MOVE_CLASSES: readonly MoveClass[] = ["light", "heavy", "climber"];

export interface ClassParams {
  /** Cell grade (percent) above which the cell is blocked: the slope is beyond what the class climbs. */
  maxGrade: number;
  /** Lowest uphill speed, percent of flat speed. Reached at a grade of `STEEP_GRADE` (`slope.ts`). */
  uphillMinPct: number;
}

export const CLASS_PARAMS: Record<MoveClass, ClassParams> = {
  light: { maxGrade: 38, uphillMinPct: 45 },
  heavy: { maxGrade: 36, uphillMinPct: 45 },
  climber: { maxGrade: 80, uphillMinPct: 85 },
};

/**
 * Per class, the largest unit radius in it (from `UNIT_STATS`). A cell whose centre is closer to a blocking
 * feature than the feature's radius plus this is blocked, so the widest hull of the class fits where a cell is open.
 */
export const CLEARANCE_RADIUS: Record<MoveClass, number> = (() => {
  const out = {} as Record<MoveClass, number>;
  for (const cls of MOVE_CLASSES) {
    out[cls] = Math.max(...UNIT_KINDS.filter((k) => UNIT_STATS[k].moveClass === cls).map((k) => UNIT_STATS[k].radius));
  }
  return out;
})();
