import { UNIT_STATS } from "@mf/sim";
import { unitPower } from "../../assess/power.ts";
import type { Board } from "../../board/board.ts";
import { goalsOf, type Goal } from "../../command/goal.ts";
import type { Knobs } from "../../knobs.ts";
import type { Memory } from "../../memory/memory.ts";
import { homeOf } from "../../plan/plan.ts";
import type { Request } from "../types.ts";
import { artilleryShare } from "./artilleryShare.ts";
import { wantedAndRest } from "./wanted.ts";

/** Missing power is bought in tank units. */
const TANK_POWER = unitPower("tank", "mobile");
/**
 * TEMPORARY until step 5 (field defense, sized asks): the army plan wants at least `minSquad` tanks, so the bot
 * still launches attacks. Floor tanks score this many credits per credit of cost.
 */
const FLOOR_VALUE = 1;

/** The army's ask in units: wanted counts and the score of the missing part, per kind. */
interface ArmyWant {
  tank: { count: number; score: number };
  artillery: { count: number; score: number };
}

export function tankAsks(board: Board, mem: Memory, knobs: Knobs): Request[] {
  const w = armyWant(board, mem, knobs).tank;
  return wantedAndRest("tank", w.count, w.score, homeOf(board.pic, mem).site);
}

export function artilleryAsks(board: Board, mem: Memory, knobs: Knobs): Request[] {
  const w = armyWant(board, mem, knobs).artillery;
  return wantedAndRest("artillery", w.count, w.score, homeOf(board.pic, mem).site);
}

/**
 * The army has what it has plus the missing goal power, in tanks; split by the counter mix; at least the floor
 * of tanks. The goal score goes to the missing units, split by count; floor units score at least `FLOOR_VALUE`.
 */
export function armyWant(board: Board, mem: Memory, knobs: Knobs): ArmyWant {
  const need = armyNeed(mem.goals);
  const { tank, artillery } = board.pic.mine;
  const total = tank.length + artillery.length + Math.ceil(need.power / TANK_POWER);
  const guns = Math.round(artilleryShare(board.known, knobs.mixQuality) * total);
  const tanks = Math.max(knobs.minSquad, total - guns);
  const missTanks = Math.max(0, tanks - tank.length);
  const missGuns = Math.max(0, guns - artillery.length);
  const missing = missTanks + missGuns;
  const score = Math.max(need.power > 0 ? need.score : 0, missTanks * UNIT_STATS.tank.cost * FLOOR_VALUE);
  const share = (n: number): number => (missing > 0 ? (score * n) / missing : 0);
  return { tank: { count: tanks, score: share(missTanks) }, artillery: { count: guns, score: share(missGuns) } };
}

/** The larger of the protect needs and the best attack's need, plus every defend need. Its score: the goals it comes from. */
function armyNeed(goals: readonly Goal[]): { power: number; score: number } {
  const protect = sumNeeds(goalsOf(goals, "protect"));
  const defend = sumNeeds(goalsOf(goals, "defend"));
  const attack = goalsOf(goals, "attack").reduce<Goal | undefined>((best, g) => (!best || g.score > best.score ? g : best), undefined);
  const attackNeed = { power: attack?.need.power ?? 0, score: attack?.score ?? 0 };
  const main = protect.power >= attackNeed.power ? protect : attackNeed;
  return { power: main.power + defend.power, score: main.score + defend.score };
}

function sumNeeds(goals: readonly Goal[]): { power: number; score: number } {
  return goals.reduce((s, g) => ({ power: s.power + (g.need.power ?? 0), score: s.score + g.score }), { power: 0, score: 0 });
}
