import { UNIT_STATS, type UnitKind } from "@mf/sim";
import type { Demand } from "./demand.ts";

const ARMY: readonly UnitKind[] = ["tank", "artillery"];

/**
 * Tank and artillery fill one army demand, split by the counter mix (`plans/asks/army.ts`). Whichever army kind is
 * chosen, the unit built is the army kind with the most units still missing that the credits cover. Ties keep the
 * chosen kind.
 */
export function armyKind(chosen: Demand, open: readonly Demand[], credits: number): UnitKind {
  if (!ARMY.includes(chosen.kind)) return chosen.kind;
  let best = chosen;
  for (const d of open) {
    if (ARMY.includes(d.kind) && d.count > best.count && UNIT_STATS[d.kind].cost <= credits) best = d;
  }
  return best.kind;
}
