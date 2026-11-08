import { ghostPower } from "../assess/power.ts";
import { centroid, within, type Point } from "../geometry.ts";
import type { Plan } from "./plan.ts";

/** Ghosts this close to a factory, or to a harvester in the base area, are raiders. */
const RAID_REACH = 1800;
/** Harvesters this close to the site are part of the base. */
export const BASE_AREA = 5000;

/** Enemies at the base: where they stand and how strong they are. */
export interface Raid {
  at: Point;
  power: number;
}

export function findRaid(p: Plan): Raid | undefined {
  const guarded = [...p.pic.mine.factory, ...p.pic.mine.harvester.filter((h) => within(h, p.home.site, BASE_AREA))];
  const raiders = p.known.filter((g) => guarded.some((u) => within(u, g, RAID_REACH)));
  if (raiders.length === 0) return undefined;
  return { at: centroid(raiders, p.pic.map), power: raiders.reduce((s, g) => s + ghostPower(g), 0) };
}
