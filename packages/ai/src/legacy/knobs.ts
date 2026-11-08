import type { Difficulty } from "../index.ts";

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
  /** Engineers per squad of tanks, and the cap. */
  engineers: number;
  /** Radar trucks to keep. */
  radars: number;
  /** Squads out in the field at once. */
  maxSquads: number;
  /** Send one tank to look for the enemy before the army is ready. */
  scout: boolean;
}

export const KNOBS: Record<Difficulty, Knobs> = {
  easy: {
    thinkEvery: 8, reactionDelay: 80, attackRatio: [0.9, 1.3], minSquad: 4, retreatRatio: 0.35,
    mixQuality: 0, harvesterTarget: 2, leaveBelow: 1, factoryTarget: 1, engineers: 0, radars: 0, maxSquads: 1, scout: false,
  },
  normal: {
    thinkEvery: 4, reactionDelay: 30, attackRatio: [1.3, 1.7], minSquad: 6, retreatRatio: 0.7,
    mixQuality: 0.6, harvesterTarget: 4, leaveBelow: 150, factoryTarget: 3, engineers: 2, radars: 1, maxSquads: 2, scout: true,
  },
  hard: {
    thinkEvery: 2, reactionDelay: 8, attackRatio: [1.2, 1.5], minSquad: 8, retreatRatio: 0.85,
    mixQuality: 1, harvesterTarget: 7, leaveBelow: 400, factoryTarget: 6, engineers: 3, radars: 1, maxSquads: 2, scout: true,
  },
};
