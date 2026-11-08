// The setup screen's roster as blocks of seats. Pure.
import { mayJoinTeam, teamCapacity, teamColor, teamName } from "../teamModel.ts";
import type { SectionView, SeatView } from "../roster/model.ts";
import { canAddBot, playerName, type SkirmishState } from "./skirmishModel.ts";

/** The roster blocks: one in free for all, else one per team in order, empty teams included. */
export function skirmishSections(s: SkirmishState): SectionView[] {
  const placed = [
    { team: s.humanTeam, seat: { kind: "player", name: playerName(s), tag: "", note: "", me: true } satisfies SeatView },
    ...s.bots.map((b) => ({ team: b.team, seat: { kind: "bot", id: b.id, name: `Bot ${b.id}`, difficulty: b.difficulty } satisfies SeatView })),
  ];
  if (s.teams === 0) {
    return [{ team: null, name: "", color: null, count: "", seats: placed.map((p) => p.seat), canJoin: false, canAddBot: canAddBot(s, null) }];
  }
  return Array.from({ length: s.teams }, (_, team): SectionView => {
    const seats = placed.filter((p) => p.team === team).map((p) => p.seat);
    return {
      team,
      name: teamName(team),
      color: teamColor(team),
      count: `${seats.length} / ${teamCapacity(s.teams)}`,
      seats,
      canJoin: mayJoinTeam(s.teams, { team: s.humanTeam, spectator: false }, team, seats.length),
      canAddBot: canAddBot(s, team),
    };
  });
}
