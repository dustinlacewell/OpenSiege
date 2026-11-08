// Teams in a roster. Pure.
import { MAX_SEATS, MAX_TEAMS } from "@mf/sim";

/** The team counts the host can pick: 0 (free for all), then 2..MAX_TEAMS. */
export const TEAM_CHOICES: readonly number[] = [0, ...Array.from({ length: MAX_TEAMS - 1 }, (_, i) => i + 2)];

/** The mode in words. `teams` is the team count: 0 = free for all. */
export function modeLabel(teams: number): string {
  return teams === 0 ? "Free for all" : `${teams} teams`;
}

/** The label of a team-count choice in the host's selector. */
export function choiceLabel(teams: number): string {
  return teams === 0 ? "Free for all" : String(teams);
}

/** Seats one team holds. Free for all has no teams: every seat. */
export function teamCapacity(teams: number): number {
  return teams === 0 ? MAX_SEATS : Math.floor(MAX_SEATS / teams);
}

/** "Team 1" for team number 0. */
export function teamName(team: number): string {
  return `Team ${team + 1}`;
}

/** The palette index of a team's colour: its number. */
export function teamColor(team: number): number {
  return team;
}

/** `mine` is the local player's seat (undefined when not joined). `count` is the seats already on `team`. */
export function mayJoinTeam(teams: number, mine: { team: number; spectator: boolean } | undefined, team: number, count: number): boolean {
  return teams > 0 && mine !== undefined && !mine.spectator && mine.team !== team && count < teamCapacity(teams);
}

/** The seats with allies together, lowest team first. Seats of one team keep their order. */
export function byTeam<T extends { team: number }>(seats: readonly T[]): T[] {
  return seats.map((s, i) => ({ s, i })).sort((a, b) => a.s.team - b.s.team || a.i - b.i).map((e) => e.s);
}
