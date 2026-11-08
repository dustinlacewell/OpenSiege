import { decide } from "./decide.ts";
import type { Bot, BotOptions } from "../index.ts";
import { KNOBS } from "./knobs.ts";
import { emptyMemory } from "./memory/memory.ts";
import { perceive } from "./perception/picture.ts";
import { between, seededRoll } from "./rng.ts";
import { studyMap, type MapStudy } from "./terrain/study.ts";

/** Wires the knobs, a seeded roll, the memory and the map study (made on the first live think). Each think: perceive, decide, return the intents. */
export function createBot(opts: BotOptions): Bot {
  const knobs = KNOBS[opts.difficulty];
  const roll = seededRoll(opts.seed);
  const phase = Math.floor(roll() * knobs.thinkEvery);
  let memory = emptyMemory(between(roll, ...knobs.attackRatio));
  let study: MapStudy | undefined;
  return {
    think(world, me) {
      if ((world.tick + phase) % knobs.thinkEvery !== 0) return [];
      const pic = perceive(world, me);
      if (!pic.alive) return [];
      study ??= studyMap(world);
      const out = decide(pic, memory, knobs, roll, study);
      memory = out.memory;
      return out.intents;
    },
  };
}
