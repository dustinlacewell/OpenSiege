import { UNIT_STATS, weaponOf, type Unit, type UnitKind, type UnitMode } from "@mf/sim";
import type { Ghost } from "../memory/memory.ts";

/** Sieged artillery splash hits crowds; count its damage this much higher. */
const SPLASH_BONUS = 1.5;
/** A radar contact of unknown kind counts as this share of a mobile tank. Many contacts are harvesters. */
const UNKNOWN_SHARE = 0.6;

/**
 * Fighting strength of one unit: sqrt(damage per tick x effective hp).
 * Lanchester's square law makes a sum of these a fair measure of a group.
 * A unit in transition counts as the mode it is heading for.
 */
export function unitPower(kind: UnitKind, mode: UnitMode, hp?: number): number {
  const settled: UnitMode = mode === "deploying" ? "sieged" : mode === "packing" ? "mobile" : mode;
  const w = weaponOf({ kind, mode: settled });
  if (!w) return 0;
  const s = UNIT_STATS[kind];
  const splash = settled === "sieged" && s.weapon === "ballistic" ? SPLASH_BONUS : 1;
  const armor = settled === "sieged" ? s.siegeArmor / 100 : 1;
  const life = (hp ?? s.maxHp) / armor;
  return Math.sqrt((w.damage / w.reload) * splash * life);
}

export const UNKNOWN_POWER = unitPower("tank", "mobile") * UNKNOWN_SHARE;

export function ghostPower(g: Ghost): number {
  return g.kind ? unitPower(g.kind, g.mode ?? "mobile", g.hp ?? undefined) : UNKNOWN_POWER;
}

export function ownPower(u: Readonly<Unit>): number {
  return unitPower(u.kind, u.mode, u.hp);
}

export function sumPower(units: readonly Readonly<Unit>[]): number {
  let s = 0;
  for (const u of units) s += ownPower(u);
  return s;
}

/** Power the units will have once deployed, for those within `r` of the point. Artillery that backs a squad counts this way. */
export function deployedPowerWithin(units: readonly Readonly<Unit>[], p: { x: number; y: number }, r: number): number {
  let s = 0;
  for (const u of units) if ((u.x - p.x) ** 2 + (u.y - p.y) ** 2 <= r * r) s += unitPower(u.kind, "sieged", u.hp);
  return s;
}

/** Power of the ghosts within `r` of the point. */
export function ghostsWithin(ghosts: readonly Ghost[], p: { x: number; y: number }, r: number): number {
  let s = 0;
  for (const g of ghosts) if ((g.x - p.x) ** 2 + (g.y - p.y) ** 2 <= r * r) s += ghostPower(g);
  return s;
}

/** Power of the own units within `r` of the point. */
export function powerWithin(units: readonly Readonly<Unit>[], p: { x: number; y: number }, r: number): number {
  let s = 0;
  for (const u of units) if ((u.x - p.x) ** 2 + (u.y - p.y) ** 2 <= r * r) s += ownPower(u);
  return s;
}
