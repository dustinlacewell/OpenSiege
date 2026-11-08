import { removeUnitsOf } from "../units.ts";
import type { IntentHandler } from "./handler.ts";
import { findPlayer } from "./lookup.ts";

/** The player is out: not connected, not alive, units removed. */
export const leave: IntentHandler<"leave"> = (world, id) => {
  const p = findPlayer(world, id);
  if (!p) return;
  p.connected = false;
  p.alive = false;
  removeUnitsOf(world, id);
};
