import { UNIT_STATS } from "@mf/sim";
import { valueOf, type Demand } from "./demand.ts";

/** While saving for the best demand, a cheaper one may still go if its value is at least this share of the best. */
const SAVE_SHARE = 0.5;

/**
 * The demand to build one unit of: the best value, if the credits cover it. Else the best affordable one worth at
 * least `SAVE_SHARE` of the best. Else none: the bot saves for the best. Value is per credit, or per build tick
 * when the bank is rich (`limitOf`).
 */
export function choose(demands: readonly Demand[], credits: number): Demand | undefined {
  const open = demands.filter((d) => d.count > 0 && d.score > 0);
  const limit = limitOf(open, credits);
  const value = (d: Demand): number => valueOf(d, limit);
  const ranked = open.sort((a, b) => value(b) - value(a));
  const best = ranked[0];
  if (!best) return undefined;
  const affordable = (d: Demand): boolean => UNIT_STATS[d.kind].cost <= credits;
  if (affordable(best)) return best;
  return ranked.find((d) => affordable(d) && value(d) >= SAVE_SHARE * value(best));
}

/** Credits are the limit until the bank covers one unit of every open demand. Then queue time is, and value goes per build tick. */
function limitOf(open: readonly Demand[], credits: number): "credits" | "time" {
  const oneOfEach = open.reduce((s, d) => s + UNIT_STATS[d.kind].cost, 0);
  return credits >= oneOfEach ? "time" : "credits";
}
