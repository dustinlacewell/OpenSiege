import { give } from "../orders.ts";
import type { IntentHandler } from "./handler.ts";
import { ownUnits, unitAt } from "./lookup.ts";

/** Only a living own unit can be guarded. The target never guards itself. */
export const guard: IntentHandler<"guard"> = (world, player, intent) => {
  const queue = intent.queue === true;
  const t = unitAt(world, intent.target);
  if (!t || t.owner !== player || t.hp <= 0) return;
  for (const u of ownUnits(world, player, intent.units)) {
    if (u !== t) give(u, { type: "guard", target: t.id, chase: false }, queue);
  }
};
