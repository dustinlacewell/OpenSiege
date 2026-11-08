// Start spots in a skirmish. Pure: no clock, no randomness; the seed is an argument.
import type { Spot } from "@mf/ai";
import { spawnEdge, type MapSize } from "@mf/sim";

/** A bot spot with the human's spot closer than this (world units) is too close; that bot picks again. */
export const BOT_CLEARANCE = 2500;

/** Integers inside [edge, side - edge] on each axis, `edge` = spawnEdge(map). A value that is not finite goes to the centre. */
export function clampSpot(map: MapSize, x: number, y: number): Spot {
  const edge = spawnEdge(map);
  return { x: clampAxis(x, map.width, edge), y: clampAxis(y, map.height, edge) };
}

function clampAxis(v: number, side: number, edge: number): number {
  if (!Number.isFinite(v)) return side >> 1;
  return Math.min(side - edge, Math.max(edge, Math.round(v)));
}

/** A spot from the seed and the seat index alone. Always inside the clamp. */
export function autoSpot(map: MapSize, seed: number, index: number): Spot {
  const edge = spawnEdge(map);
  return {
    x: edge + (mix(seed, index * 2 + 1) % (map.width - 2 * edge + 1)),
    y: edge + (mix(seed, index * 2 + 2) % (map.height - 2 * edge + 1)),
  };
}

/** A bot's own seed: the match seed mixed with its player id, so bots in one match differ. */
export function botSeed(matchSeed: number, player: number): number {
  return (matchSeed ^ Math.imul(player, 0x9e3779b1)) >>> 0;
}

/** A small integer hash to a non-negative 32-bit value. */
function mix(a: number, b: number): number {
  let h = Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b + 0x7f4a7c15, 0xc2b2ae35);
  h ^= h >>> 15;
  h = Math.imul(h, 0x2c1b3c6d);
  h ^= h >>> 12;
  h = Math.imul(h, 0x297a2d39);
  h ^= h >>> 15;
  return h >>> 0;
}
