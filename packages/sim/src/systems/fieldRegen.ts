import { FIELD_AMOUNT } from "../world.ts";
import type { World } from "../types.ts";

const REGEN_EVERY = 10;

/** Fields refill by one credit every REGEN_EVERY ticks, up to full. */
export function fieldRegen(world: World): void {
  if (world.tick % REGEN_EVERY !== 0) return;
  for (const f of world.fields) if (f.amount < FIELD_AMOUNT) f.amount++;
}
