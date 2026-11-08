import { BOOST_MOBILE_EVERY, BOOST_SIEGED } from "./stats.ts";
import type { World } from "./types.ts";

/** Extra job progress this tick for factory `f`, from engineers whose `work` names it (set last tick by `repair`). */
export function boostOf(world: World, f: { id: number }): number {
  let sum = 0;
  for (const u of world.units) {
    if (u.kind !== "engineer" || u.work !== f.id) continue;
    if (u.mode === "sieged") sum += BOOST_SIEGED;
    else if (u.mode === "mobile" && world.tick % BOOST_MOBILE_EVERY === 0) sum += 1;
  }
  return sum;
}
