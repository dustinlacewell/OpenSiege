import { MAX_SEATS, MAX_TEAMS } from "./seats.ts";

// Team numbers of seats. Pure. `teams` is the match's team count: 0 = free for all, else 2..MAX_TEAMS.

/** A team count a match may hold: 0 (free for all) or an integer in 2..MAX_TEAMS. */
export function validTeams(teams: number): boolean {
  return teams === 0 || (Number.isInteger(teams) && teams >= 2 && teams <= MAX_TEAMS);
}

/** Seats one team holds. `teams` is 2..MAX_TEAMS. */
export function teamCap(teams: number): number {
  return Math.floor(MAX_SEATS / teams);
}

/** Seats per team, indexed by team number. Numbers outside 0..teams-1 are not counted. */
export function teamSizes(used: readonly number[], teams: number): number[] {
  const sizes = new Array<number>(teams).fill(0);
  for (const t of used) if (t >= 0 && t < teams) sizes[t]!++;
  return sizes;
}

/** Whether `team` is a team of a `teams` match and holds fewer than `teamCap(teams)` seats. False in free for all. */
export function teamHasRoom(used: readonly number[], teams: number, team: number): boolean {
  if (teams === 0 || !Number.isInteger(team) || team < 0 || team >= teams) return false;
  return teamSizes(used, teams)[team]! < teamCap(teams);
}

/** The team with the fewest seats that still has room (ties: lowest number), else null. */
export function emptiestTeam(used: readonly number[], teams: number): number | null {
  return emptiestOf(teamSizes(used, teams), teamCap(teams));
}

function emptiestOf(sizes: readonly number[], cap: number): number | null {
  let best: number | null = null;
  for (let t = 0; t < sizes.length; t++) {
    if (sizes[t]! < cap && (best === null || sizes[t]! < sizes[best]!)) best = t;
  }
  return best;
}

/**
 * The team a new free-for-all seat gets: the lowest number that no seat in `used` holds, so no two seats are allies.
 * A match with open seating has no seat cap for humans, so the number is not bounded by MAX_SEATS.
 */
export function freeTeam(used: readonly number[]): number {
  let t = 0;
  while (used.includes(t)) t++;
  return t;
}

/**
 * New team numbers for `seats` (in seat order) when the match goes from `from` teams to `to` teams. `from` and `to` differ.
 * To free for all: every seat gets its own number, 0, 1, 2... From free for all: each seat in turn takes the emptiest team.
 * Between team counts: seats whose team still exists and is under the new cap stay (in seat order);
 * the rest, in seat order, take the emptiest team with room.
 */
export function rehome(seats: readonly number[], from: number, to: number): number[] {
  if (to === 0) return seats.map((_, i) => i);
  const cap = teamCap(to);
  const sizes = new Array<number>(to).fill(0);
  const stays = seats.map((t) => {
    const stay = from > 0 && t >= 0 && t < to && sizes[t]! < cap;
    if (stay) sizes[t]!++;
    return stay;
  });
  return seats.map((t, i) => {
    if (stays[i]) return t;
    const team = emptiestOf(sizes, cap) ?? 0;
    sizes[team]!++;
    return team;
  });
}
