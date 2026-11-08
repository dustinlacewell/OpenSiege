import { crossErrors, fieldErrors, type UnitStats } from "@mf/sim";
import type { Row, Rules } from "../tableEditor/schema.ts";

// The unit editor's rules: the sim's own checks, and which stats a unit's other stats switch off. Pure.

type StatKey = keyof UnitStats;

const WEAPON_KEYS: readonly StatKey[] = ["damage", "range", "reload", "shotSpeed", "splash", "dig", "maxPitch", "minRange", "gunX", "gunZ", "gunLength", "gunRest"];
const SIEGE_WEAPON_KEYS: readonly StatKey[] = ["siegeDamage", "siegeRange"];
const SIEGE_KEYS: readonly StatKey[] = ["siegeArmor", "sink", "siegeWorkRate", "siegeRadar", "siegeJam"];

/** False when the unit's other fields make this one do nothing. The cell is dimmed, not hidden. */
export function isRelevant(row: UnitStats, key: StatKey): boolean {
  const armed = row.weapon !== "none";
  const sieges = row.siegeTicks > 0;
  if (WEAPON_KEYS.includes(key)) return armed;
  if (SIEGE_WEAPON_KEYS.includes(key)) return armed && sieges;
  if (SIEGE_KEYS.includes(key)) return sieges;
  return true;
}

export function unitLabel(kind: string): string {
  return kind.charAt(0).toUpperCase() + kind.slice(1);
}

/** The one place a row is read as a unit's stats. The sim's `UnitStats` is an interface, so it is not assignable to `Row`. */
function asUnit(row: Row): UnitStats {
  return row as unknown as UnitStats;
}

export const UNIT_RULES: Rules = {
  field: (column, key, value) => fieldErrors(column, key as StatKey, value)[0]?.message,
  cross(column, row) {
    const out: Record<string, string> = {};
    for (const e of crossErrors(column, asUnit(row))) if (e.field) out[e.field] ??= e.message;
    return out;
  },
  relevant: (row, key) => isRelevant(asUnit(row), key as StatKey),
};
