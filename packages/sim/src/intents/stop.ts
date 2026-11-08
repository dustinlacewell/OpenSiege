import type { IntentHandler } from "./handler.ts";
import { ownUnits } from "./lookup.ts";

/** Clears the order queue. The mode stays. */
export const stop: IntentHandler<"stop"> = (world, player, intent) => {
  for (const u of ownUnits(world, player, intent.units)) {
    u.orders = [];
    u.arrived = 0;
  }
};
