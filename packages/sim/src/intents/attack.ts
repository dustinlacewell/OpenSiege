import { buildGrid } from "../grid.ts";
import { detect } from "../detection.ts";
import { mapSize } from "../mapSize.ts";
import { give } from "../orders.ts";
import { isEnemy } from "../teams.ts";
import type { Unit, World } from "../types.ts";
import type { IntentHandler } from "./handler.ts";
import { ownUnits, unitAt } from "./lookup.ts";

/**
 * Only an existing enemy unit that `player`'s team detects can be a target. An order on an ally or an undetected enemy is ignored.
 * The order keeps where the target is now: its last detected spot.
 */
export const attack: IntentHandler<"attack"> = (world, player, intent) => {
  const queue = intent.queue === true;
  const t = unitAt(world, intent.target);
  if (!t || !isEnemy(world.players, player, t.owner) || !detected(world, player, t)) return;
  for (const u of ownUnits(world, player, intent.units)) give(u, { type: "attack", target: t.id, hold: false, x: t.x, y: t.y }, queue);
};

/** One grid build per intent. Players click and the AI emits attacks too (`packages/ai/src/emit/emit.ts`); the host caps a client at 30 intents a tick. */
function detected(world: World, player: number, t: Unit): boolean {
  return detect(world, buildGrid(world.units, mapSize(world.terrain))).detects(player, t);
}
