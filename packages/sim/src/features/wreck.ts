import { UNIT_STATS } from "../stats.ts";
import type { Feature, Unit } from "../types.ts";

/**
 * What a dead unit leaves, at its spot with its radius. `scrapHp` above 0: `scrap`, that hp. 0: `wreckage`.
 * Pure: the caller gives the new id and adds the result to the world.
 */
export function wreckFor(unit: Pick<Unit, "kind" | "x" | "y">, id: number): Feature {
  const s = UNIT_STATS[unit.kind];
  const scrap = s.scrapHp > 0;
  return { id, kind: scrap ? "scrap" : "wreckage", x: unit.x, y: unit.y, radius: s.radius, hp: scrap ? s.scrapHp : 0, variant: 0, unit: unit.kind };
}

/** What a scrap destroyed by shells or crushing turns into: charred ground at the same spot, from the same unit. Reclaimed scrap leaves none. */
export function wreckageOf(scrap: Feature, id: number): Feature {
  return { id, kind: "wreckage", x: scrap.x, y: scrap.y, radius: scrap.radius, hp: 0, variant: scrap.variant, unit: scrap.unit };
}
