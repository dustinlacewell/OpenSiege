import type { Intent, Stamped } from "@mf/sim";

// The match message contract. Flow:
//  1. The host sends `welcome` with the world after tick T (T = 0), encoded by @mf/sim
//     encodeWorld. Every player's `join` (with the picked spot) lands in turn T+1.
//  2. Every TICK_MS the host sends `turn` N with all intents it received, in arrival order.
//     Every client steps turn N exactly once, in order N = T+1, T+2, ...
//  3. Every HASH_EVERY ticks the client sends `hash` for that tick. The host compares to its own.
//  4. When at most one player is left alive, the host sends `ended` and drops the match.
// Messages carry no map size. The world in `welcome` holds the terrain; the map's
// width and height come from it (`mapSize(world.terrain)` in @mf/sim).

export const HASH_EVERY = 50;

export type MatchClientMsg =
  | { t: "intent"; intent: Intent }
  | { t: "hash"; tick: number; hash: number };

export type MatchMsg =
  /** The round begins: the world after tick T (0) and a `join` for every player in turn T+1. */
  | { t: "welcome"; you: number; world: string }
  | { t: "turn"; tick: number; intents: Stamped[] }
  | { t: "desync"; tick: number }
  /** The match is over. `winners` are the names of the players on the last team alive; empty when no team is left. */
  | { t: "ended"; winners: string[] };
