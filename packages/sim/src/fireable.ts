import { UNIT_STATS } from "./stats.ts";
import { weaponOf } from "./weapons.ts";
import { aim } from "./launch.ts";
import type { Unit, World } from "./types.ts";

/**
 * True when `u` is armed and its gun has a firing solution on `t` (`aim`; a direct shot clears the terrain).
 * A mine fires no shell, so it needs no solution. Range and `minRange` are `reach`'s test, not this one.
 */
export function canFire(world: World, u: Unit, t: Unit): boolean {
  if (!weaponOf(u)) return false;
  return UNIT_STATS[u.kind].weapon === "mine" || aim(world, u, t) !== undefined;
}
