import { generateMap, DEFAULT_MAP_PARAMS, type MapSpec } from "@mf/sim";
import type { SkirmishPlan } from "../../src/game/skirmish/plan.ts";

/** One human and two bots of different difficulty, each on its own team (free for all). */
export const FFA_PLAN: SkirmishPlan = {
  name: "Ann",
  teams: 0,
  seats: [
    { kind: "human", team: 0 },
    { kind: "bot", name: "Bot 1", team: 1, difficulty: "easy" },
    { kind: "bot", name: "Bot 2", team: 2, difficulty: "hard" },
  ],
};

/** Two teams: the human and one bot against two bots. */
export const TEAM_PLAN: SkirmishPlan = {
  name: "Ann",
  teams: 2,
  seats: [
    { kind: "human", team: 0 },
    { kind: "bot", name: "Bot 1", team: 0, difficulty: "normal" },
    { kind: "bot", name: "Bot 2", team: 1, difficulty: "normal" },
    { kind: "bot", name: "Bot 3", team: 1, difficulty: "hard" },
  ],
};

/** What the host does for a random map: a spec from the seed. */
export const mapFor = (seed: number): MapSpec => generateMap(seed, DEFAULT_MAP_PARAMS);
