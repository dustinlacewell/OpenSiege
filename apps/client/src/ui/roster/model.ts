// What a roster shows: blocks of seats, one block per team. Pure.
import type { Difficulty } from "@mf/ai";

/**
 * One seat in the roster. A player's `tag` is the text after the name and `note` the text at the seat's right edge;
 * either is "" when there is none.
 */
export type SeatView =
  | { kind: "player"; name: string; tag: string; note: string; me: boolean }
  | { kind: "bot"; id: number; name: string; difficulty: Difficulty };

/** One block of the roster: a team, or in a free-for-all the one block of every seat. */
export interface SectionView {
  /** The team number; null in a free-for-all, which has no header. */
  team: number | null;
  /** "Team 1"; "" in free for all. */
  name: string;
  /** The palette index of the team colour; null in free for all. */
  color: number | null;
  /** "2 / 4"; "" in free for all. */
  count: string;
  /** Players then bots, in seat order. */
  seats: SeatView[];
  /** A click on the header moves the local player here. */
  canJoin: boolean;
  /** A bot may be added here: there is a free seat and this team has room. */
  canAddBot: boolean;
}
