import type { Player } from "@mf/sim";

/** Pure. Is the match over, and who won: every player on the one team that still has an alive member. Empty when no team is left. */
export function localOutcome(players: readonly Player[]): { over: boolean; winners: string[] } {
  const alive = players.filter((p) => p.alive);
  const teams = new Set(alive.map((p) => p.team));
  if (teams.size > 1) return { over: false, winners: [] };
  const last = alive[0];
  return { over: true, winners: last ? players.filter((p) => p.team === last.team).map((p) => p.name) : [] };
}
