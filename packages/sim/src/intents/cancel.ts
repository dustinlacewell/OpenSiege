import { MAX_QUEUE, UNIT_STATS } from "../stats.ts";
import { toInt } from "../math.ts";
import type { IntentHandler } from "./handler.ts";
import { findPlayer, ownFactory } from "./lookup.ts";

/**
 * Drops each listed job id, in list order, and refunds its full cost, which `build` charged at enqueue.
 * Ids not in the queue are skipped. A list that is not an array or holds more than MAX_QUEUE ids does nothing.
 */
export const cancel: IntentHandler<"cancel"> = (world, player, intent) => {
  const f = ownFactory(world, player, intent.factory);
  const p = findPlayer(world, player);
  const rawJobs: unknown = intent.jobs;
  if (!f || !p || !Array.isArray(rawJobs) || rawJobs.length > MAX_QUEUE) return;
  for (const raw of rawJobs as unknown[]) {
    const id = toInt(raw);
    const at = id === null ? -1 : f.queue.findIndex((j) => j.id === id);
    if (at < 0) continue;
    const [job] = f.queue.splice(at, 1);
    p.credits += UNIT_STATS[job!.kind].cost;
  }
};
