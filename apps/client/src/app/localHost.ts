// The offline host: a match played on this machine, with scripted bots, the tutorial or the dev sandbox.
import type { Spot } from "@mf/ai";
import type { Intent, MapSpec, World } from "@mf/sim";
import { SANDBOX_SIDES, sandboxWorld } from "../dev/sandboxWorld.ts";
import type { SkirmishPlan, SkirmishSetup } from "../game/skirmish/plan.ts";
import { skirmishPlacement } from "../game/skirmish/placement.ts";
import { skirmishWorld } from "../game/skirmish/world.ts";
import { tutorialEnemy } from "../game/tutorial/enemy.ts";
import { TutorialGuide } from "../game/tutorial/guide.ts";
import { tutorialMatch } from "../game/tutorial/match.ts";
import { LocalMatch, type LocalBot } from "../match/localMatch.ts";
import type { MatchHost, MatchLink } from "./matchHost.ts";

/** A match to play: the starting world, the player the client commands, and the computer players. */
export interface LocalPlan {
  world: World;
  you: number;
  bots: readonly LocalBot[];
}

export interface LocalHostOptions {
  /** The player leaves, or the end card asks to go home. */
  onHome?(): void;
  /** The turn clock. Defaults to setInterval. */
  every?(ms: number, fn: () => void): () => void;
  /** The seed of a skirmish: its generated map and its bots' start spots. Defaults to a random 32-bit number. */
  seed?(): number;
}

const randomSeed = (): number => (Math.random() * 0x100000000) >>> 0;

/** Hosts one offline match at a time on a `LocalMatch` clock. */
export class LocalHost implements MatchHost {
  private link: MatchLink | null = null;
  private match: LocalMatch | null = null;
  /** True while the player picks a start spot for a skirmish. */
  private placing = false;

  constructor(private readonly options: LocalHostOptions = {}) {}

  attach(link: MatchLink): void {
    this.link = link;
  }

  /** True from the start of a match, or of its start-spot pick, until the player leaves it. */
  active(): boolean {
    return this.match !== null || this.placing;
  }

  /** Plays `plan`. */
  play(plan: LocalPlan): void {
    this.halt();
    this.run(plan);
  }

  /**
   * A match against computer players on a map from `setup.draw`. The player first clicks a start spot on the map,
   * where the bots' spots are marked; with `setup.auto` the match starts at once. Leaving the pick goes home.
   */
  skirmish(setup: SkirmishSetup): void {
    const link = this.needLink();
    const seed = (this.options.seed ?? randomSeed)();
    let spec: MapSpec;
    try {
      spec = setup.draw.spec(seed);
    } catch (err) {
      console.error("skirmish:", err);
      return;
    }
    this.halt();
    if (setup.auto) {
      this.playSkirmish(spec, setup.plan, seed, null);
      return;
    }
    this.placing = true;
    link.place(skirmishPlacement({
      spec, plan: setup.plan, seed,
      onPick: (spot) => this.playSkirmish(spec, setup.plan, seed, spot),
      onLeave: () => this.leave(),
    }));
  }

  /** The offline tutorial match, gated by its lesson. Its end is a thank-you card. */
  tutorial(): void {
    const link = this.needLink();
    let match: ReturnType<typeof tutorialMatch>;
    try {
      match = tutorialMatch();
    } catch (err) {
      console.error("tutorial:", err);
      return;
    }
    this.halt();
    const guide = new TutorialGuide(match.lesson, () => link.view());
    link.guide(guide);
    link.endCard("tutorial");
    this.run({ world: match.world, you: match.you, bots: [tutorialEnemy(match.lesson, guide, match.enemy)] });
  }

  /** Dev only: a two-side match where this client commands every side. */
  sandbox(): void {
    this.halt();
    this.run({ world: sandboxWorld(Date.now() >>> 0), you: SANDBOX_SIDES[0], bots: [] });
    this.needLink().sandbox(true);
  }

  intent(as: number, intent: Intent): void {
    this.match?.send(as, intent);
  }

  leave(): void {
    this.halt();
    this.options.onHome?.();
  }

  desync(): void {
    this.leave();
  }

  /** Seats everyone with the player on `spot` (null: from the seed) and plays. A bad plan is logged and the pick stays. */
  private playSkirmish(spec: MapSpec, plan: SkirmishPlan, seed: number, spot: Spot | null): void {
    let start: ReturnType<typeof skirmishWorld>;
    try {
      start = skirmishWorld(spec, plan, seed, spot);
    } catch (err) {
      console.error("skirmish:", err);
      return;
    }
    this.play({ world: start.world, you: start.you, bots: start.bots });
  }

  private run(plan: LocalPlan): void {
    const link = this.needLink();
    this.match = new LocalMatch({
      deliver: (msg) => link.deliver(msg),
      world: () => link.world(),
      paused: () => link.paused(),
      ...(this.options.every ? { every: this.options.every } : {}),
    });
    this.match.start(plan.world, plan.you, plan.bots);
  }

  /** Stops the clock and the match on the client, and drops the tutorial guide. */
  private halt(): void {
    this.match?.stop();
    this.match = null;
    this.placing = false;
    this.link?.stop();
  }

  private needLink(): MatchLink {
    if (!this.link) throw new Error("LocalHost: not attached");
    return this.link;
  }
}
