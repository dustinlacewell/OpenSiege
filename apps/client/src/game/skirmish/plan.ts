// What a skirmish is made of: who sits where. Plain data. The setup screen makes it, the world builder reads it.
import type { Difficulty } from "@mf/ai";
import type { MapDraw } from "@mf/map";

/** One seat. Seat `i` is player `i + 1`. In free for all every seat has its own team number. */
export type SkirmishSeat =
  | { kind: "human"; team: number }
  | { kind: "bot"; name: string; team: number; difficulty: Difficulty };

export interface SkirmishPlan {
  /** The human's name. */
  name: string;
  /** Number of teams: 0 = free for all, else 2..MAX_TEAMS. */
  teams: number;
  /** Exactly one human. At most MAX_SEATS seats. */
  seats: readonly SkirmishSeat[];
}

/** What Play hands to the host: the map, the seats, and whether the start spot is chosen for the player. */
export interface SkirmishSetup {
  draw: MapDraw;
  plan: SkirmishPlan;
  auto: boolean;
}
