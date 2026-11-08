import type { UnitKind, UnitMode } from "@mf/sim";
import type { Point } from "../geometry.ts";
import type { Task } from "../tasks.ts";
import { emptyExplored, type Explored } from "./explored.ts";

/** A remembered enemy: where and what it was when last seen or sensed. */
export interface Ghost {
  id: number;
  owner: number;
  x: number;
  y: number;
  /** null: only ever a radar contact. */
  kind: UnitKind | null;
  mode: UnitMode | null;
  hp: number | null;
  firstSeen: number;
  lastSeen: number;
}

export type SquadState = "attack" | "gather" | "retreat" | "defend";

/** Tanks that move and fight as one. */
export interface Squad {
  id: number;
  members: readonly number[];
  state: SquadState;
  /** Where the squad drives now. */
  goal: Point;
  /** What the attack is for. `gather` drives to `goal` first, then resumes toward this. */
  target: Point;
  /** The ratio rolled for this squad (`Knobs.attackRatio`). */
  k: number;
  /** No enemy known at the goal: the squad looks around. */
  scouting: boolean;
  since: number;
}

/** The task the emitter last issued to one unit. */
export interface Assignment {
  task: Task;
  key: string;
  /** Tick of the last intent for this task. -1 = not sent yet. */
  issued: number;
  /** Units that got the same intent. Sets how close counts as arrived. */
  size: number;
}

export type PlannerName = "economy" | "production" | "base" | "army" | "artillery" | "support";

/** Everything the bot carries from one think to the next. Planners never edit it; they return new slices. */
export interface Memory {
  ghosts: ReadonlyMap<number, Ghost>;
  /** Last tick each scout cell was in sight, -1 never (`memory/explored.ts`). */
  explored: Explored;
  assignments: ReadonlyMap<number, Assignment>;
  squads: readonly Squad[];
  nextSquad: number;
  /** The ratio the next squad launches with. */
  nextK: number;
  /** Harvester id to field id. */
  harvest: ReadonlyMap<number, number>;
  /** Where the main factory lives, and since when. */
  site: Point | null;
  siteSince: number;
  /** Unit id to its last stay-or-go choice and the tick it flipped. Stops flip-flop (`plan/follow.ts`). */
  modeSince: ReadonlyMap<number, { stay: boolean; since: number }>;
  /** The lone scout tank, its goal, and how many scouts were sent. */
  scout: number | null;
  scoutGoal: Point | null;
  scoutsSent: number;
  lastRun: Readonly<Record<PlannerName, number>>;
}

export function emptyMemory(firstK: number): Memory {
  return {
    ghosts: new Map(),
    explored: emptyExplored(),
    assignments: new Map(),
    squads: [],
    nextSquad: 1,
    nextK: firstK,
    harvest: new Map(),
    site: null,
    siteSince: 0,
    modeSince: new Map(),
    scout: null,
    scoutGoal: null,
    scoutsSent: 0,
    lastRun: { economy: -1e9, production: -1e9, base: -1e9, army: -1e9, artillery: -1e9, support: -1e9 },
  };
}
