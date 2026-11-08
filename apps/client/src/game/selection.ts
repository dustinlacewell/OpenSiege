import type { Unit, UnitKind } from "@mf/sim";
import { unitById } from "./lookup.ts";

/** `hit` alone, or added to `current`. Sorted, no duplicates. */
export function combine(current: readonly number[], hit: readonly number[], additive: boolean): number[] {
  if (!additive) return [...hit];
  return [...new Set([...current, ...hit])].sort((p, q) => p - q);
}

/** Ids of all own units. */
export function ownUnits(units: readonly Unit[], me: number): number[] {
  return units.filter((u) => u.owner === me).map((u) => u.id);
}

/** Ids of all own units of `kind`, anywhere on the map. */
export function ownOfKind(units: readonly Unit[], me: number, kind: UnitKind): number[] {
  return units.filter((u) => u.owner === me && u.kind === kind).map((u) => u.id);
}

/** Drops ids of units that no longer exist. Returns the same array when nothing changed. */
export function pruneDead(selected: readonly number[], units: readonly Unit[]): readonly number[] {
  if (selected.every((id) => unitById(units, id))) return selected;
  return selected.filter((id) => unitById(units, id));
}
