import { UNIT_STATS, type UnitKind } from "@mf/sim";

/** Ticks until a lost harvester is replaced and back at work: build time plus the trip. */
export const REPLACE_TICKS = 250;
/** Credits a sieged harvester earns per tick. */
export const HARVEST_RATE = 5;
/** Build work a lost factory takes with it: 4 a tick, sieged, for the 300 ticks a new factory takes. */
const REBUILD_WORK = 4 * 300;

/** Cost times the hp fraction. Full hp when `hp` is not known. */
export function unitWorth(kind: UnitKind, hp?: number | null): number {
  const s = UNIT_STATS[kind];
  return (s.cost * (hp ?? s.maxHp)) / s.maxHp;
}

/** A harvester also carries the income it would earn until a new one replaces it. */
export function harvesterWorth(hp?: number | null): number {
  return unitWorth("harvester", hp) + HARVEST_RATE * REPLACE_TICKS;
}

/** A factory: its cost, the build work lost until it is replaced, and its share of the player's worth. */
export function factoryWorth(lifePremium: number, hp?: number | null): number {
  return unitWorth("factory", hp) + REBUILD_WORK + lifePremium;
}

/** What losing this unit costs its side: a factory with its life premium, a harvester with its lost income, else its worth. */
export function lossWorth(kind: UnitKind, hp: number | null | undefined, lifePremium: number): number {
  if (kind === "factory") return factoryWorth(lifePremium, hp);
  if (kind === "harvester") return harvesterWorth(hp);
  return unitWorth(kind, hp);
}
