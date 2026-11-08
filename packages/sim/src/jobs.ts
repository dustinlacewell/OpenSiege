import { MAX_QUEUE, UNIT_STATS } from "./stats.ts";
import type { Player, Unit, UnitKind, World } from "./types.ts";

/**
 * Queue one `kind` job on factory `f` for `owner`. Needs the full cost and a free slot.
 * Charges the cost now. The job id is `world.nextId++`. False when nothing was queued.
 * The `build` intent and quota top-up both use this, so their rules cannot drift.
 */
export function enqueueJob(world: World, owner: Player, f: Unit, kind: UnitKind): boolean {
  const cost = UNIT_STATS[kind].cost;
  if (owner.credits < cost || f.queue.length >= MAX_QUEUE) return false;
  owner.credits -= cost;
  f.queue.push({ id: world.nextId++, kind, progress: 0 });
  return true;
}
