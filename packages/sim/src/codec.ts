import type { World } from "./types.ts";

/** Full state copy for a player who joins mid-game. */
export function encodeWorld(world: World): string {
  return JSON.stringify(world);
}

export function decodeWorld(text: string): World {
  return JSON.parse(text) as World;
}
