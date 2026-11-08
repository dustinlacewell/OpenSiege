import type { Intent } from "@mf/sim";
import { groupGhosts } from "./assess/groups.ts";
import { buildThreat } from "./assess/threat.ts";
import { emit } from "./emit/emit.ts";
import type { Knobs } from "./knobs.ts";
import { markExplored } from "./memory/explored.ts";
import { knownGhosts, updateGhosts } from "./memory/ghosts.ts";
import type { Memory } from "./memory/memory.ts";
import type { Picture } from "./perception/picture.ts";
import { homeOf, type Plan } from "./plan/plan.ts";
import { isDue, SCHEDULE } from "./plan/schedule.ts";
import type { Roll } from "./rng.ts";
import type { Assign } from "./tasks.ts";

/** Intents one think may send. The host caps a player per tick; stay well under it. */
const INTENT_CAP = 40;

/** One think: remember what was sensed, run the planners that are due, emit what changed. */
export function decide(pic: Picture, before: Memory, knobs: Knobs, roll: Roll): { intents: Intent[]; memory: Memory } {
  let mem = remember(pic, before);
  const known = knownGhosts(mem.ghosts, pic.tick, knobs.reactionDelay);
  const threat = buildThreat(known, pic.map);
  const groups = groupGhosts(known, pic.map);
  const intents: Intent[] = [];
  const assign: Assign[] = [];
  for (const slot of SCHEDULE) {
    if (!isDue(slot, mem.lastRun[slot.name], pic.tick)) continue;
    const plan: Plan = { pic, mem, knobs, roll, known, threat, groups, home: homeOf(pic, mem) };
    const r = slot.run(plan);
    mem = { ...mem, ...r.memory, lastRun: { ...mem.lastRun, [slot.name]: pic.tick } };
    intents.push(...r.intents);
    assign.push(...r.assign);
  }
  const out = emit(pic.own, mem.assignments, assign, pic.tick, INTENT_CAP - intents.length);
  return { intents: [...intents, ...out.intents], memory: { ...mem, assignments: out.assignments } };
}

function remember(pic: Picture, mem: Memory): Memory {
  return { ...mem, ghosts: updateGhosts(mem.ghosts, pic), explored: markExplored(mem.explored, pic.eyes, pic.tick, pic.map) };
}
