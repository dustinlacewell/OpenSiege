import { UNIT_STATS } from "./stats.ts";
import type { Unit } from "./types.ts";

/** Take damage, reduced by siege armor while sieged. */
export function applyDamage(t: Unit, amount: number): void {
  const armor = t.mode === "sieged" ? UNIT_STATS[t.kind].siegeArmor : 100;
  t.hp -= Math.floor((amount * armor) / 100);
}
