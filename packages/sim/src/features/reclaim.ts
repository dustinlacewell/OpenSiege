import { RECLAIM_PERCENT, UNIT_STATS } from "../stats.ts";
import type { Feature, UnitKind } from "../types.ts";

/** Credits a scrap of `unit` with `hp` left pays in total: RECLAIM_PERCENT of the cost at full hp, less in proportion. */
export function scrapValue(unit: UnitKind, hp: number): number {
  const s = UNIT_STATS[unit];
  return Math.floor((s.cost * RECLAIM_PERCENT * hp) / (100 * s.scrapHp));
}

/** A scrap with hp left and a known unit kind. */
export function reclaimable(f: Feature | undefined): f is Feature {
  return f !== undefined && f.kind === "scrap" && f.hp > 0 && f.unit !== undefined;
}

/**
 * Take up to `rate` hp off reclaimable scrap `f`. Returns the credits for the hp taken.
 * The credits are the drop in `scrapValue`, so the floors telescope: all steps together pay `scrapValue` of the start hp.
 */
export function reclaimStep(f: Feature, rate: number): number {
  const unit = f.unit!;
  const before = scrapValue(unit, f.hp);
  f.hp -= Math.min(rate, f.hp);
  return before - scrapValue(unit, f.hp);
}
