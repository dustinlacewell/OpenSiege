import { UNIT_STATS, type UnitKind } from "@mf/sim";
import { within, type Point } from "../geometry.ts";
import type { Ghost, SquadState } from "../memory/memory.ts";

/** An armed enemy this close to the squad centre is contact: tank siege range. */
const ENGAGE = UNIT_STATS.tank.siegeRange;
/** Ticks the siege holds after the last sighting of an armed enemy in range. */
export const HOLD = 50;

/**
 * An attacking or defending squad sieges in place while an armed enemy was seen within tank siege range of its
 * centre in the last `HOLD` ticks. Siege takes 1 s and roughly triples a tank's fight value (1.5x damage, half damage
 * taken), so in contact it almost always improves the outcome. A retreating or gathering squad never sieges.
 * Idle tanks at staging are the held line facing the front: the pool's goto sieges on arrival (`plan/army.ts`).
 */
export function shouldSiege(state: SquadState, centre: Point, known: readonly Ghost[], tick: number): boolean {
  if (state === "retreat" || state === "gather") return false;
  return known.some((g) => isArmed(g.kind) && tick - g.lastSeen < HOLD && within(g, centre, ENGAGE));
}

/** Tanks, artillery, and radar contacts of unknown kind can shoot back. */
export function isArmed(kind: UnitKind | null): boolean {
  return kind === null || kind === "tank" || kind === "artillery";
}
