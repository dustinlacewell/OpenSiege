import { MAX_QUEUE, UNIT_STATS, type Intent, type UnitKind, type World } from "@mf/sim";
import { playerById, unitById } from "../game/lookup.ts";
import type { UiCue } from "./cues.ts";

/**
 * Pure. The interface sound for an intent the player is sending, or null.
 * A build plays "refused" when the sim will reject it: too few credits or a full queue.
 */
export function intentCue(intent: Intent, world: World | null, me: number): UiCue | null {
  switch (intent.t) {
    case "move":
    case "attack":
    case "guard":
    case "reclaim":
    case "rally":
      return "ack";
    case "build":
      return world && buildAccepted(world, me, intent.factory, intent.kind) ? "queued" : "refused";
    default:
      return null;
  }
}

function buildAccepted(world: World, me: number, factory: number, kind: UnitKind): boolean {
  const credits = playerById(world.players, me)?.credits ?? 0;
  const queue = unitById(world.units, factory)?.queue.length ?? MAX_QUEUE;
  return credits >= UNIT_STATS[kind].cost && queue < MAX_QUEUE;
}
