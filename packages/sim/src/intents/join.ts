import { START_CREDITS } from "../stats.ts";
import { spawnPlayer } from "../spawn.ts";
import type { Player, World } from "../types.ts";
import type { IntentHandler } from "./handler.ts";
import { findPlayer } from "./lookup.ts";

const COLORS = 12;

/**
 * Adds the player once and spawns its start units. A second join for the same id does nothing.
 * Teammates share a colour; a player alone on its team takes the colour of its id.
 */
export const join: IntentHandler<"join"> = (world, id, intent) => {
  if (findPlayer(world, id)) return;
  const name: unknown = intent.name;
  const team = Number.isInteger(intent.team) ? intent.team! : -1 - id;
  const player: Player = {
    id,
    name: typeof name === "string" ? name : "",
    color: (team >= 0 ? team : id) % COLORS,
    credits: START_CREDITS,
    alive: true,
    connected: true,
    team,
  };
  insertPlayer(world, player);
  spawnPlayer(world, id, intent.x === undefined || intent.y === undefined ? undefined : { x: intent.x, y: intent.y });
};

/** Keep players sorted by id even if the host hands ids out of order. */
function insertPlayer(world: World, player: Player): void {
  const at = world.players.findIndex((p) => p.id > player.id);
  if (at < 0) world.players.push(player);
  else world.players.splice(at, 0, player);
}
