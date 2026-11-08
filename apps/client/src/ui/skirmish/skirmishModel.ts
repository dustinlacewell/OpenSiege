// The skirmish setup screen's state, and the steps on it. Pure.
import { DIFFICULTIES, type Difficulty } from "@mf/ai";
import { emptiestTeam, freeTeam, MAX_SEATS, rehome, teamCap, teamHasRoom, teamSizes, validTeams } from "@mf/sim";
import type { SkirmishPlan } from "../../game/skirmish/plan.ts";

export const DEFAULT_NAME = "Player";
export const NAME_MAX = 16;

/** A computer player's seat. */
export interface BotSeat {
  id: number;
  difficulty: Difficulty;
  team: number;
}

/** The human is always seat 0, on `humanTeam`; the bots follow in the order they were added. */
export interface SkirmishState {
  /** The library map's stem, or null for a generated map. */
  mapId: string | null;
  /** Number of teams: 0 = free for all, else 2..MAX_TEAMS. */
  teams: number;
  humanTeam: number;
  bots: readonly BotSeat[];
  /** The id the next bot gets. */
  nextBot: number;
  /** The name field, as typed. */
  name: string;
  /** Start without choosing a spot. */
  auto: boolean;
}

/** Free for all, the generated map, one normal bot. */
export function initialSkirmish(name: string): SkirmishState {
  return { mapId: null, teams: 0, humanTeam: 0, bots: [{ id: 1, difficulty: "normal", team: 1 }], nextBot: 2, name, auto: false };
}

export function seatCount(s: SkirmishState): number {
  return 1 + s.bots.length;
}

/** The team of every seat: the human's, then the bots'. */
export function teamsOfSeats(s: SkirmishState): number[] {
  return [s.humanTeam, ...s.bots.map((b) => b.team)];
}

/** Whether a bot fits: under MAX_SEATS seats and, in a team game, `team` (any team when null) is under its cap. */
export function canAddBot(s: SkirmishState, team: number | null): boolean {
  if (seatCount(s) >= MAX_SEATS) return false;
  if (s.teams === 0) return true;
  return team === null ? emptiestTeam(teamsOfSeats(s), s.teams) !== null : teamHasRoom(teamsOfSeats(s), s.teams, team);
}

/** Adds a "normal" bot named by its id. Free for all: the lowest free team number; `team` is ignored. No change when it does not fit. */
export function addBot(s: SkirmishState, team: number | null): SkirmishState {
  if (!canAddBot(s, team)) return s;
  const seatTeam = s.teams === 0 ? freeTeam(teamsOfSeats(s)) : (team ?? emptiestTeam(teamsOfSeats(s), s.teams)!);
  return { ...s, bots: [...s.bots, { id: s.nextBot, difficulty: "normal", team: seatTeam }], nextBot: s.nextBot + 1 };
}

export function removeBot(s: SkirmishState, id: number): SkirmishState {
  return { ...s, bots: s.bots.filter((b) => b.id !== id) };
}

/** Steps the bot to the next difficulty, wrapping from the last to the first. */
export function cycleBot(s: SkirmishState, id: number): SkirmishState {
  return { ...s, bots: s.bots.map((b) => (b.id === id ? { ...b, difficulty: nextDifficulty(b.difficulty) } : b)) };
}

function nextDifficulty(d: Difficulty): Difficulty {
  return DIFFICULTIES[(DIFFICULTIES.indexOf(d) + 1) % DIFFICULTIES.length]!;
}

/** Moves the human to `team`. No change in free for all, for a bad number or a full team. */
export function joinTeam(s: SkirmishState, team: number): SkirmishState {
  const others = s.bots.map((b) => b.team);
  if (s.humanTeam === team || !teamHasRoom(others, s.teams, team)) return s;
  return { ...s, humanTeam: team };
}

/** Sets the team count and re-homes the seats (see `rehome`). No change for a bad value, the same value, or more seats than the teams hold. */
export function setTeams(s: SkirmishState, teams: number): SkirmishState {
  if (!validTeams(teams) || teams === s.teams) return s;
  if (teams > 0 && seatCount(s) > teams * teamCap(teams)) return s;
  const moved = rehome(teamsOfSeats(s), s.teams, teams);
  return { ...s, teams, humanTeam: moved[0]!, bots: s.bots.map((b, i) => ({ ...b, team: moved[i + 1]! })) };
}

export function setMap(s: SkirmishState, mapId: string | null): SkirmishState {
  return { ...s, mapId };
}

/** The next (`by` 1) or previous (-1) map in `ids`, wrapping. An id not in the list steps from the first. */
export function stepMap(s: SkirmishState, ids: readonly (string | null)[], by: 1 | -1): SkirmishState {
  if (ids.length === 0) return s;
  const at = Math.max(0, ids.indexOf(s.mapId));
  return { ...s, mapId: ids[(at + by + ids.length) % ids.length]! };
}

export function setName(s: SkirmishState, name: string): SkirmishState {
  return { ...s, name };
}

export function setAuto(s: SkirmishState, auto: boolean): SkirmishState {
  return { ...s, auto };
}

/** The name as played: trimmed, cut to NAME_MAX, "Player" when empty. */
export function playerName(s: SkirmishState): string {
  return s.name.trim().slice(0, NAME_MAX).trim() || DEFAULT_NAME;
}

/** Why the match cannot start, or null when it can. */
export function problem(s: SkirmishState): string | null {
  if (s.bots.length === 0) return "Add an opponent";
  if (seatCount(s) > MAX_SEATS) return `At most ${MAX_SEATS} seats`;
  if (s.teams > 0 && teamSizes(teamsOfSeats(s), s.teams).some((n) => n > teamCap(s.teams))) return "A team is full";
  if (s.bots.every((b) => b.team === s.humanTeam)) return "Put an opponent on another team";
  return null;
}

/** The seats as played. Throws when `problem` is not null. */
export function toPlan(s: SkirmishState): SkirmishPlan {
  const bad = problem(s);
  if (bad !== null) throw new Error(`skirmish: ${bad}`);
  return {
    name: playerName(s),
    teams: s.teams,
    seats: [{ kind: "human", team: s.humanTeam }, ...s.bots.map((b) => ({ kind: "bot" as const, name: `Bot ${b.id}`, team: b.team, difficulty: b.difficulty }))],
  };
}
