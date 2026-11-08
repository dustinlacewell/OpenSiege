import { toInt } from "../math.ts";
import { clampX, clampY, mapSize } from "../mapSize.ts";
import type { IntentHandler } from "./handler.ts";
import { ownUnits } from "./lookup.ts";

/** Only factories keep a rally point; other kinds are skipped. The point is clamped to the map. */
export const rally: IntentHandler<"rally"> = (world, player, intent) => {
  const x = toInt(intent.x), y = toInt(intent.y);
  if (x === null || y === null) return;
  const m = mapSize(world.terrain);
  for (const u of ownUnits(world, player, intent.units)) {
    if (u.kind === "factory") u.rally = { x: clampX(m, x), y: clampY(m, y) };
  }
};
