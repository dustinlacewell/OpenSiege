import type { FieldState } from "../board/fields.ts";
import { chance } from "../worth/chance.ts";
import { HARVEST_RATE, harvesterWorth, REPLACE_TICKS } from "../worth/unit.ts";
import type { CommandContext } from "./context.ts";
import type { Goal } from "./goal.ts";

/** The economy plan's rule for a field worth working: credits left, and danger net of guards (`plan/economy.ts`). */
const CLAIM_MIN = 400;
const SAFE_LIMIT = 15;
const GUARD_SHARE = 0.7;
/** Harvesters one field asks for at most. */
const MAX_SLOTS = 3;

/**
 * One per safe-enough field. Each slot earns until the field is dry or the harvester would be replaced, whichever is
 * shorter, at the chance the field holds; it risks a harvester's worth with its lost income. One slot per
 * `HARVEST_RATE × REPLACE_TICKS` credits left, 1 to `MAX_SLOTS`.
 */
export function fieldGoals(c: CommandContext): Goal[] {
  return c.board.fields.filter(workable).map((f) => {
    const p = chance(f.ownPower, f.danger);
    const slots = Math.min(MAX_SLOTS, Math.max(1, Math.floor(f.amount / (HARVEST_RATE * REPLACE_TICKS))));
    const perSlot = HARVEST_RATE * Math.min(f.amount / HARVEST_RATE, REPLACE_TICKS) * p - harvesterWorth() * (1 - p);
    return { id: `field:${f.id}`, kind: "field", at: { x: f.x, y: f.y }, score: perSlot * slots, need: { kind: "harvester", count: slots } };
  });
}

function workable(f: FieldState): boolean {
  return f.amount >= CLAIM_MIN && f.danger - GUARD_SHARE * f.ownPower <= SAFE_LIMIT;
}
