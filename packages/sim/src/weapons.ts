import { UNIT_STATS } from "./stats.ts";
import type { Unit } from "./types.ts";

/** `minRange`: the nearest flat distance it picks a target at, the same in both modes. */
export interface Weapon { damage: number; range: number; minRange: number; reload: number }

/** Mobile or siege weapon by mode. None while unarmed or in transition. */
export function weaponOf(u: Pick<Unit, "kind" | "mode">): Weapon | undefined {
  const s = UNIT_STATS[u.kind];
  if (s.damage <= 0) return undefined;
  if (u.mode === "mobile") return { damage: s.damage, range: s.range, minRange: s.minRange, reload: s.reload };
  if (u.mode === "sieged") return { damage: s.siegeDamage, range: s.siegeRange, minRange: s.minRange, reload: s.reload };
  return undefined;
}

/** Base range plus the shooter's height advantage over the target, capped at +50%. */
export function effectiveRange(base: number, shooterGround: number, targetGround: number): number {
  const bonus = Math.max(0, shooterGround - targetGround);
  return base + Math.min(bonus, Math.floor(base / 2));
}

/** The farthest any effective range can reach. */
export function maxRange(base: number): number {
  return base + Math.floor(base / 2);
}
