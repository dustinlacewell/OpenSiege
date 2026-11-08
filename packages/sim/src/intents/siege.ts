import { give } from "../orders.ts";
import type { IntentHandler } from "./handler.ts";
import { ownUnits } from "./lookup.ts";

/** Gives a deploy or pack-up order. The modes system carries it out. */
export const siege: IntentHandler<"siege"> = (world, player, intent) => {
  const on = intent.on === true, queue = intent.queue === true;
  for (const u of ownUnits(world, player, intent.units)) give(u, { type: "siege", on }, queue);
};
