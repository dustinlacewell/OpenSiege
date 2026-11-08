import type { Unit, UnitKind } from "@mf/sim";
import type { Board } from "../board/board.ts";
import type { Point } from "../geometry.ts";
import type { Knobs } from "../knobs.ts";
import type { Memory } from "../memory/memory.ts";
import type { Plan, PlanResult } from "../plan/plan.ts";

export type { PlanResult } from "../plan/plan.ts";

/**
 * A plan asks for units of one kind. `count`: how many; Infinity takes every one there is. `power`: stop once the
 * units taken sum to this power. `score` orders the requests, highest first. `near`: nearer units go first.
 */
export interface Request {
  role: string;
  kind: UnitKind;
  count: number;
  power?: number;
  score: number;
  near: Point;
}

/** One kind of plan: what units it asks for, and what it does with the units it was given. */
export interface PlanKind {
  id: string;
  /** The goals the requests come from are in `mem.goals`. The unfilled part of a request is a build demand. */
  requests(board: Board, mem: Memory, knobs: Knobs): Request[];
  /** `members` come in `pic.own` order. */
  run(plan: Plan, members: readonly Readonly<Unit>[]): PlanResult;
}
