// An offline match clock. It sends the same messages a match host sends, through the client's own handler, and runs scripted bots.
import type { MatchMsg } from "@mf/protocol";
import { encodeWorld, TICK_MS, type Intent, type Stamped, type World } from "@mf/sim";
import { localOutcome } from "./localOutcome.ts";

/** At most this many intents from one bot are kept each turn, like a match host's cap. */
export const MAX_LOCAL_BOT_INTENTS = 60;

/** A computer player. Same shape as `@mf/ai`'s bot `think`; the client does not import that package. */
export interface LocalBot {
  player: number;
  think(world: World, me: number): Intent[];
}

export interface LocalMatchDeps {
  /** The client's match-message path (`handleMatch`). */
  deliver(msg: MatchMsg): void;
  /** The world the client stepped, read for the end rule and by the bots. */
  world(): World | null;
  /** Runs `fn` every `ms`. Returns a cancel. Defaults to setInterval. */
  every?(ms: number, fn: () => void): () => void;
  /** While true, time stops: no turn, no bot thinks. Queued intents wait. Defaults to never. */
  paused?(): boolean;
}

const intervalEvery = (ms: number, fn: () => void): (() => void) => {
  const id = setInterval(fn, ms);
  return () => clearInterval(id);
};

/**
 * A match with no remote host: welcome, then one turn every TICK_MS with the intents queued since the last one,
 * each stamped with its player. Bots think after each turn. Ends when at most one team is alive.
 * A paused clock skips its turns.
 */
export class LocalMatch {
  private pending: Stamped[] = [];
  private tick = 0;
  private cancel: (() => void) | null = null;
  private bots: readonly LocalBot[] = [];
  private threw = new Set<number>();

  constructor(private readonly deps: LocalMatchDeps) {}

  /** Welcome with `world` as player `you`, then the turn clock. */
  start(world: World, you: number, bots: readonly LocalBot[] = []): void {
    this.tick = world.tick;
    this.bots = bots;
    this.threw.clear();
    this.deps.deliver({ t: "welcome", you, world: encodeWorld(world) });
    this.cancel = (this.deps.every ?? intervalEvery)(TICK_MS, () => this.turn());
  }

  /** Queues an intent for the next turn, stamped with `player`. */
  send(player: number, intent: Intent): void {
    if (intent.t === "join" || intent.t === "leave") return;
    this.pending.push({ player, intent });
  }

  stop(): void {
    this.cancel?.();
    this.cancel = null;
    this.pending = [];
  }

  private turn(): void {
    if (this.deps.paused?.()) return;
    const intents = this.pending;
    this.pending = [];
    this.deps.deliver({ t: "turn", tick: ++this.tick, intents });
    if (this.checkEnd()) return;
    this.thinkBots();
  }

  private checkEnd(): boolean {
    const outcome = localOutcome(this.deps.world()?.players ?? []);
    if (!outcome.over) return false;
    this.stop();
    this.deps.deliver({ t: "ended", winners: outcome.winners });
    return true;
  }

  private thinkBots(): void {
    const world = this.deps.world();
    if (!world) return;
    for (const bot of this.bots) {
      for (const intent of this.botIntents(bot, world)) this.send(bot.player, intent);
    }
  }

  /** The bot's intents for this turn, capped. A throw gives none and is logged once per bot. */
  private botIntents(bot: LocalBot, world: World): Intent[] {
    try {
      return bot.think(world, bot.player).filter((i) => i.t !== "join" && i.t !== "leave").slice(0, MAX_LOCAL_BOT_INTENTS);
    } catch (err) {
      if (!this.threw.has(bot.player)) {
        this.threw.add(bot.player);
        console.warn(`local bot (player ${bot.player}) threw at world tick ${world.tick}:`, err);
      }
      return [];
    }
  }
}
