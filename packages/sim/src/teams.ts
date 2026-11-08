import type { Player } from "./types.ts";

/** Team of player `id`. A player not in the list stands alone: its team is `-1 - id`, which no match team number equals. */
export function teamOf(players: readonly Player[], id: number): number {
  for (const p of players) if (p.id === id) return p.team;
  return -1 - id;
}

/** True for the same player or two players on one team. */
export function sameTeam(players: readonly Player[], a: number, b: number): boolean {
  return a === b || teamOf(players, a) === teamOf(players, b);
}

/** True when `a` and `b` are on different teams. The one test for who may be picked as a target. */
export function isEnemy(players: readonly Player[], a: number, b: number): boolean {
  return !sameTeam(players, a, b);
}
