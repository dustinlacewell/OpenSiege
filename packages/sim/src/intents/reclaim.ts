import { give } from "../orders.ts";
import { toInt } from "../math.ts";
import { findFeature } from "../features/findFeature.ts";
import { reclaimable } from "../features/reclaim.ts";
import type { IntentHandler } from "./handler.ts";
import { ownUnits } from "./lookup.ts";

/** Only a scrap with hp left can be reclaimed. Scrap has no owner. Only engineers take the order. */
export const reclaim: IntentHandler<"reclaim"> = (world, player, intent) => {
  const queue = intent.queue === true;
  const id = toInt(intent.target);
  const f = id === null ? undefined : findFeature(world, id);
  if (!reclaimable(f)) return;
  for (const u of ownUnits(world, player, intent.units)) {
    if (u.kind === "engineer") give(u, { type: "reclaim", target: f.id }, queue);
  }
};
