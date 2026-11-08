import type { Intent, World } from "@mf/sim";

/** Every difficulty, easiest first. */
export const DIFFICULTIES = ["easy", "normal", "hard"] as const;

/** How hard a bot plays. Knobs, not a second AI. */
export type Difficulty = (typeof DIFFICULTIES)[number];

/**
 * One computer player. The host calls `think` after every sim step with the
 * stepped world and the bot's own player id. The bot returns the intents to
 * queue for the next turn, the same intents a human client sends.
 *
 * The bot never writes `world`. It keeps its own memory inside the object.
 * It sees only what its units can see (sight and radar), plus what it remembers.
 */
export interface Bot {
  think(world: Readonly<World>, me: number): Intent[];
}

export interface BotOptions {
  difficulty: Difficulty;
  /** Seed for the bot's own choices. Bots run on the host only, so this is for variety, not lockstep. */
  seed: number;
}

export { createBot } from "./bot.ts";
export { createLegacyBot } from "./legacy/bot.ts";
export { createBot as createFrozenBot } from "./frozen/bot.ts";
export { botStartSpot as frozenStartSpot } from "./frozen/start/botStartSpot.ts";
export { pickStartSpot, type Spot, type StartKnobs, type TakenSpot } from "./start/pickStartSpot.ts";
export { botStartSpot } from "./start/botStartSpot.ts";
