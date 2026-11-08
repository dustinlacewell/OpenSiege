import { toInt } from "../math.ts";
import { findUnit } from "../units.ts";
import type { Player, Unit, World } from "../types.ts";

// Lookups the intent handlers share. Each drops what the player may not touch.

const MAX_UNITS_PER_ORDER = 500;

export function findPlayer(world: World, id: number): Player | undefined {
  return world.players.find((p) => p.id === id);
}

/** The player's own units named in `ids`, capped. Unknown and foreign ids drop out. */
export function ownUnits(world: World, player: number, ids: unknown): Unit[] {
  if (!Array.isArray(ids)) return [];
  const out: Unit[] = [];
  for (const raw of ids.slice(0, MAX_UNITS_PER_ORDER)) {
    const id = toInt(raw);
    const u = id === null ? undefined : findUnit(world, id);
    if (u && u.owner === player) out.push(u);
  }
  return out;
}

/** The unit with this raw id, or undefined. */
export function unitAt(world: World, rawId: unknown): Unit | undefined {
  const id = toInt(rawId);
  return id === null ? undefined : findUnit(world, id);
}

/** The player's own factory with this raw id, or undefined. */
export function ownFactory(world: World, player: number, rawId: unknown): Unit | undefined {
  const f = unitAt(world, rawId);
  return f && f.owner === player && f.kind === "factory" ? f : undefined;
}
