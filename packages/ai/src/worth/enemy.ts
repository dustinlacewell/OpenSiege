import { START_CREDITS, UNIT_STATS } from "@mf/sim";
import { unitPower, UNKNOWN_POWER } from "../assess/power.ts";
import type { Ghost } from "../memory/memory.ts";
import type { SideWorth } from "./own.ts";
import { unitWorth } from "./unit.ts";

/** Share of enemy worth guessed to be army. */
const ARMY_SHARE = 0.4;
/** A radar contact of unknown kind is worth this share of a tank, as in its power. */
const UNKNOWN_WORTH = UNKNOWN_POWER / unitPower("tank", "mobile") * UNIT_STATS.tank.cost;

/**
 * The enemy under fog: the larger of the worth seen and a guess from time (start credits plus elapsed ticks times
 * `income`). Killed enemy worth is not subtracted yet. Lives: distinct remembered enemy factories, at least 1.
 */
export function enemyWorth(known: readonly Ghost[], tick: number, income: number): SideWorth {
  const seen = known.reduce((s, g) => s + ghostWorth(g), 0);
  const worth = Math.max(seen, START_CREDITS + tick * income);
  const lives = Math.max(1, known.filter((g) => g.kind === "factory").length);
  return { worth, lives, lifePremium: worth / lives };
}

/** A remembered enemy at its last known hp. */
export function ghostWorth(g: Ghost): number {
  return g.kind ? unitWorth(g.kind, g.hp) : UNKNOWN_WORTH;
}

/** The army the enemy could field: its army share of worth, in tanks, times one tank's power. */
export function enemyPowerEstimate(worth: number): number {
  return ((worth * ARMY_SHARE) / UNIT_STATS.tank.cost) * unitPower("tank", "mobile");
}
