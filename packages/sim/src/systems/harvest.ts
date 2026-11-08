import { dist2 } from "../math.ts";
import { workRateOf } from "../units.ts";
import type { Player, ResourceField, Unit, World } from "../types.ts";

/** Harvesters inside a non-empty field move credits from the field to their owner. */
export function harvest(world: World): void {
  for (const u of world.units) {
    if (u.kind !== "harvester") continue;
    const rate = workRateOf(u);
    if (rate <= 0) continue;
    const field = fieldUnder(world.fields, u);
    const owner = field && findOwner(world.players, u.owner);
    if (!field || !owner) continue;
    const take = Math.min(rate, field.amount);
    field.amount -= take;
    owner.credits += take;
  }
}

/** The first non-empty field whose disc holds the unit's position. The client's idle-harvester key reads it too. */
export function fieldUnder(fields: readonly ResourceField[], u: Pick<Unit, "x" | "y">): ResourceField | undefined {
  return fields.find((f) => f.amount > 0 && dist2(f.x, f.y, u.x, u.y) <= f.radius * f.radius);
}

function findOwner(players: readonly Player[], id: number): Player | undefined {
  return players.find((p) => p.id === id);
}
