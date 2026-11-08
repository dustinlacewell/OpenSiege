import type { Unit, UnitKind } from "@mf/sim";
import { unitById } from "./lookup.ts";

/** Control groups 1..9. Index 0 is unused so a group number is its index. Each group is sorted ids. */
export type Groups = readonly (readonly number[])[];

/** Highest group number. */
export const GROUP_COUNT = 9;
/** A second press of the same group key within this many ms centres the camera. */
export const DOUBLE_TAP_MS = 350;

/** The last group key press: which group and when (ms). */
export interface Recall {
  n: number;
  at: number;
}

export function emptyGroups(): Groups {
  return Array.from({ length: GROUP_COUNT + 1 }, () => []);
}

/** Group `n` becomes exactly `ids`. */
export function saveGroup(groups: Groups, n: number, ids: readonly number[]): Groups {
  return withGroup(groups, n, sorted(ids));
}

/** `ids` join group `n`. */
export function addToGroup(groups: Groups, n: number, ids: readonly number[]): Groups {
  return withGroup(groups, n, sorted([...(groups[n] ?? []), ...ids]));
}

/** The members of group `n` that still exist. */
export function liveMembers(groups: Groups, n: number, units: readonly Unit[]): number[] {
  return (groups[n] ?? []).filter((id) => unitById(units, id));
}

/** Simple groups: the kind each group key selects. Group 9 selects nothing. */
export const SIMPLE_GROUP_KINDS: Readonly<Record<number, UnitKind>> = {
  1: "factory", 2: "harvester", 3: "engineer", 4: "tank", 5: "artillery", 6: "radar", 7: "mine", 8: "jammer",
};

/** Simple groups: group `n` is every unit `owner` has of the kind `SIMPLE_GROUP_KINDS` gives it. */
export function kindMembers(units: readonly Unit[], owner: number, n: number): number[] {
  const kind = SIMPLE_GROUP_KINDS[n];
  return kind ? units.filter((u) => u.owner === owner && u.kind === kind).map((u) => u.id) : [];
}

/** The lowest group that holds `id`, or 0. */
export function groupOf(groups: Groups, id: number): number {
  for (let n = 1; n <= GROUP_COUNT; n++) if (groups[n]?.includes(id)) return n;
  return 0;
}

/** True when this press repeats the last one on the same group soon enough. */
export function isDoubleTap(prev: Recall | null, n: number, at: number): boolean {
  return prev !== null && prev.n === n && at - prev.at <= DOUBLE_TAP_MS;
}

/** The mean position of the units, or null with none. */
export function centreOf(units: readonly Unit[], ids: readonly number[]): { x: number; y: number } | null {
  let x = 0, y = 0, n = 0;
  for (const id of ids) {
    const u = unitById(units, id);
    if (!u) continue;
    x += u.x;
    y += u.y;
    n++;
  }
  return n === 0 ? null : { x: x / n, y: y / n };
}

function withGroup(groups: Groups, n: number, ids: readonly number[]): Groups {
  if (n < 1 || n > GROUP_COUNT) return groups;
  return groups.map((g, i) => (i === n ? ids : g));
}

function sorted(ids: readonly number[]): number[] {
  return [...new Set(ids)].sort((p, q) => p - q);
}
