import { UNIT_STATS } from "@mf/sim";
import type { Picture } from "../perception/picture.ts";
import { unitWorth } from "./unit.ts";

/** One player's worth and lives. The life premium is what one factory carries of the whole. */
export interface SideWorth {
  worth: number;
  lives: number;
  lifePremium: number;
}

/** Own units at their hp, plus credits, plus the cost of queued jobs (paid at enqueue). Lives: own factories, at least 1. */
export function ownWorth(pic: Picture): SideWorth {
  let worth = pic.credits;
  for (const u of pic.own) worth += unitWorth(u.kind, u.hp);
  for (const f of pic.mine.factory) for (const j of f.queue) worth += UNIT_STATS[j.kind].cost;
  const lives = Math.max(1, pic.mine.factory.length);
  return { worth, lives, lifePremium: worth / lives };
}
