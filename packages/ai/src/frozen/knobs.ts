import type { Difficulty } from "../index.ts";
import type { StartKnobs } from "./start/pickStartSpot.ts";

/** Every number that makes one difficulty differ from another. One brain, these dials. */
export interface Knobs {
  /** Ticks between two thinks. The bot does nothing in between. */
  thinkEvery: number;
  /** Ticks a new contact must be known before the bot reacts to it. */
  reactionDelay: number;
  /** A squad launches when its power is at least k times the enemy power at the target. k is rolled per squad in this range. */
  attackRatio: readonly [number, number];
  /** Fewest tanks in a launched squad. */
  minSquad: number;
  /** A squad falls back when its power drops below this times the enemy power around it. */
  retreatRatio: number;
  /** 0: a fixed army mix that ignores the enemy. 1: the mix fully counters what was seen. */
  mixQuality: number;
  /** Harvesters the bot keeps alive. */
  harvesterTarget: number;
  /** A harvester leaves its field for another when the credits left drop under this and another field is free to claim. Low: it sits on a drained field. */
  leaveBelow: number;
  /** Factories the bot keeps alive. Extra factories build and are extra lives. */
  factoryTarget: number;
  /** Engineers are built while income is above build speed, up to three times this. 0: none. */
  engineers: number;
  /** Radar trucks to keep. */
  radars: number;
  /** Squads out in the field at once. */
  maxSquads: number;
  /** Send one tank to look for the enemy before the army is ready. */
  scout: boolean;
  /** How the bot picks its start spot (`start/pickStartSpot.ts`). */
  start: StartKnobs;
  /** How fast each scar layer of the danger map fades (`danger/scar.ts`). */
  danger: DangerKnobs;
  /** Credits per tick a typical enemy is guessed to earn. Feeds the fog estimate of enemy worth (`worth/enemy.ts`). */
  enemyIncome: number;
  /** Share of the guessed enemy army each factory is protected against, even with no enemy in sight. */
  insurance: number;
}

/** Half-lives in ticks. Losses fade slowest, sightings fastest. */
export interface DangerKnobs {
  sightHalfLife: number;
  damageHalfLife: number;
  lossHalfLife: number;
}

/** The same for every difficulty for now. */
const DANGER: DangerKnobs = { sightHalfLife: 300, damageHalfLife: 600, lossHalfLife: 1200 };

export const KNOBS: Record<Difficulty, Knobs> = {
  easy: {
    thinkEvery: 8, reactionDelay: 80, attackRatio: [0.9, 1.3], minSquad: 4, retreatRatio: 0.35,
    mixQuality: 0, harvesterTarget: 2, leaveBelow: 1, factoryTarget: 1, engineers: 0, radars: 0, maxSquads: 1, scout: false,
    start: { wealthWeight: 0.5, topN: 6 }, danger: DANGER, enemyIncome: 8, insurance: 0.3,
  },
  normal: {
    thinkEvery: 4, reactionDelay: 30, attackRatio: [1.3, 1.7], minSquad: 6, retreatRatio: 0.7,
    mixQuality: 0.6, harvesterTarget: 4, leaveBelow: 150, factoryTarget: 3, engineers: 2, radars: 1, maxSquads: 2, scout: true,
    start: { wealthWeight: 0.6, topN: 3 }, danger: DANGER, enemyIncome: 8, insurance: 0.3,
  },
  hard: {
    thinkEvery: 2, reactionDelay: 8, attackRatio: [1.2, 1.5], minSquad: 8, retreatRatio: 0.85,
    mixQuality: 1, harvesterTarget: 7, leaveBelow: 400, factoryTarget: 6, engineers: 3, radars: 1, maxSquads: 2, scout: true,
    start: { wealthWeight: 0.6, topN: 1 }, danger: DANGER, enemyIncome: 8, insurance: 0.3,
  },
};
