import { BUILDABLE } from "../stats.ts";
import { enqueueJob } from "../jobs.ts";
import type { IntentHandler } from "./handler.ts";
import { findPlayer, ownFactory } from "./lookup.ts";

/** Queues a job on an own factory. Charges the full cost now; needs the credits and a free slot. */
export const build: IntentHandler<"build"> = (world, player, intent) => {
  const f = ownFactory(world, player, intent.factory);
  const p = findPlayer(world, player);
  const k = BUILDABLE.find((b) => b === intent.kind);
  if (!f || !p || !k) return;
  enqueueJob(world, p, f, k);
};
