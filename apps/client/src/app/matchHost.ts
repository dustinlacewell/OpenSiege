// The seam between the client and whatever runs its match: the host feeds turns in, the client sends intents out.
import type { MatchMsg } from "@mf/protocol";
import type { Intent, World } from "@mf/sim";
import type { Placement } from "../game/placement.ts";
import type { Guide } from "../game/tutorial/guide.ts";
import type { TutorialView } from "../game/tutorial/runner.ts";

/** What the end card says after a match: the result, or the tutorial's thank-you. */
export type EndKind = "match" | "tutorial";

/** Runs the match the client shows. The client calls it; it never reaches past it. */
export interface MatchHost {
  /** Once, from `startClient`. The host feeds the match through `link`. */
  attach(link: MatchLink): void;
  /** The local player's intent. `as` is the player the client commands (`session.self`). Never join or leave. */
  intent(as: number, intent: Intent): void;
  /** Every HASH_EVERY ticks: the hash of the world the client stepped. */
  checkpoint?(tick: number, hash: number): void;
  /** The player leaves: the pause menu's Leave, the end card's button. */
  leave(): void;
  /** The client's world fell out of step with the turns, or a turn was missed. Start over. */
  desync(): void;
}

/** What the host drives on the client. */
export interface MatchLink {
  /** A match message: welcome, turn, ended or desync. */
  deliver(msg: MatchMsg): void;
  /** The world the client stepped, or null outside a match. */
  world(): World | null;
  /** True while the tutorial guide stops time. */
  paused(): boolean;
  /** What the tutorial reads each frame, or null until the camera is home. */
  view(): TutorialView | null;
  /** The tutorial's guide, or null for none. A guide also switches auto-siege off. */
  guide(guide: Guide | null): void;
  /** On: this client commands every side and picks one from the leaderboard. */
  sandbox(on: boolean): void;
  /** What the end card shows when the match ends. */
  endCard(kind: EndKind): void;
  /** The choose-your-start phase; null ends it. */
  place(placement: Placement | null): void;
  /** Drops the match, the placement and the end card: the canvas shows the backdrop again. */
  stop(): void;
}
