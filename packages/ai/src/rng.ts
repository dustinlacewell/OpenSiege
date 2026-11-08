/** A seeded source of numbers in [0, 1). The bot's own, never the sim's. */
export type Roll = () => number;

/** mulberry32. Bots run on the host only, so this is for variety, not lockstep. */
export function seededRoll(seed: number): Roll {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A number in [lo, hi). */
export function between(roll: Roll, lo: number, hi: number): number {
  return lo + (hi - lo) * roll();
}
