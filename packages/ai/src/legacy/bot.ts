// Frozen copy of the bot at commit 13a9f4e, a fixed baseline to compare bots against. Delete when the hierarchical bot lands.
import type { Bot, BotOptions } from "../index.ts";
import { decide } from "./decide.ts";
import { KNOBS } from "./knobs.ts";
import { emptyMemory } from "./memory/memory.ts";
import { perceive } from "./perception/picture.ts";
import { between, seededRoll } from "./rng.ts";

/** Wires the knobs, a seeded roll and the memory. Each think: perceive, decide, return the intents. */
export function createLegacyBot(opts: BotOptions): Bot {
  const knobs = KNOBS[opts.difficulty];
  const roll = seededRoll(opts.seed);
  const phase = Math.floor(roll() * knobs.thinkEvery);
  let memory = emptyMemory(between(roll, ...knobs.attackRatio));
  return {
    think(world, me) {
      if ((world.tick + phase) % knobs.thinkEvery !== 0) return [];
      const pic = perceive(world, me);
      if (!pic.alive) return [];
      const out = decide(pic, memory, knobs, roll);
      memory = out.memory;
      return out.intents;
    },
  };
}
