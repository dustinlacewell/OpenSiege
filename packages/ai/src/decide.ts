import type { Intent } from "@mf/sim";
import { buildThreat } from "./assess/threat.ts";
import { buildBoard, type Board } from "./board/board.ts";
import { emit } from "./emit/emit.ts";
import type { Knobs } from "./knobs.ts";
import { markExplored } from "./memory/explored.ts";
import { forgottenGhosts, updateGhosts } from "./memory/ghosts.ts";
import type { Memory } from "./memory/memory.ts";
import type { Picture } from "./perception/picture.ts";
import { homeOf, type Plan, type PlanResult } from "./plan/plan.ts";
import { allocate, membersOf, type Allocation } from "./plans/allocate.ts";
import { isDue, PLANS, SCHEDULE, type Slot } from "./plans/registry.ts";
import type { Roll } from "./rng.ts";
import type { MapStudy } from "./terrain/study.ts";
import type { Assign } from "./tasks.ts";

/** Intents one think may send. The host caps a player per tick; stay well under it. */
const INTENT_CAP = 40;

/** One think: remember what was sensed, build the board, give units to plans, run the slots that are due, emit what changed. */
export function decide(pic: Picture, before: Memory, knobs: Knobs, roll: Roll, study: MapStudy): { intents: Intent[]; memory: Memory } {
  let mem = remember(pic, before);
  const built = buildBoard(pic, mem, knobs, forgottenGhosts(before.ghosts, mem.ghosts), study);
  mem = { ...mem, ...built.memory };
  mem = { ...mem, ...allocateUnits(built.board, mem, knobs) };
  // The ported planners do not read the board yet; they get the same known ghosts, threat map and groups as before.
  const { board } = built;
  const { known, groups } = board;
  const threat = buildThreat(known, pic.map);
  const intents: Intent[] = [];
  const assign: Assign[] = [];
  for (const slot of SCHEDULE) {
    if (!isDue(slot, mem.lastRun[slot.name], pic.tick)) continue;
    const plan: Plan = { pic, mem, knobs, roll, known, threat, groups, home: homeOf(pic, mem), board };
    const r = runSlot(slot, plan, mem.allocation);
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

/** Every plan asks, due or not, so a unit stays held between its plan's runs. Production builds for the unfilled requests. */
function allocateUnits(board: Board, mem: Memory, knobs: Knobs): Pick<Memory, "allocation" | "unfilled"> {
  const asked = PLANS.flatMap((kind) => kind.requests(board, mem, knobs).map((request) => ({ plan: kind.id, request })));
  return allocate(asked, board.pic.own, mem.allocation);
}

function runSlot(slot: Slot, plan: Plan, allocation: Allocation): PlanResult {
  return "plan" in slot ? slot.plan.run(plan, membersOf(allocation, plan.pic.own, slot.plan.id)) : slot.step(plan);
}
