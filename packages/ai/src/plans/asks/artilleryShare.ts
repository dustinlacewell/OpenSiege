import type { Ghost } from "../../memory/memory.ts";

/** Artillery share of the army when the bot ignores the enemy. Too much: mobile artillery is weak. */
const BLIND_SHARE = 0.45;
/** Artillery share against an all-artillery enemy, and the extra share against an all-tank enemy. */
const COUNTER_FLOOR = 0.15;
const COUNTER_SPAN = 0.35;

/** Many enemy tanks: more artillery to shell them. Enemy artillery: more tanks to rush it. `quality` blends blind and counter. */
export function artilleryShare(known: readonly Ghost[], quality: number): number {
  let tanks = 0;
  let guns = 0;
  for (const g of known) {
    if (g.kind === "tank") tanks++;
    else if (g.kind === "artillery") guns++;
  }
  const counter = tanks + guns > 0 ? COUNTER_FLOOR + COUNTER_SPAN * (tanks / (tanks + guns)) : BLIND_SHARE;
  return BLIND_SHARE * (1 - quality) + counter * quality;
}
