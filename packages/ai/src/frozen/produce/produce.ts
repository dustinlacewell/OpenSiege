import { UNIT_STATS, type Intent, type UnitKind } from "@mf/sim";
import type { Plan, PlanResult } from "../plan/plan.ts";
import { armyKind } from "./armyKind.ts";
import { choose } from "./choose.ts";
import { demandsFrom, less, type Demand } from "./demand.ts";
import { cancelStale, queuedAfter } from "./stale.ts";

/** Jobs a factory holds at most. A short queue keeps builds current and credits free. */
const QUEUE_LEN = 2;

/**
 * Builds what the plans asked for and did not get. Cancels queued jobs no demand wants, takes the queued jobs off
 * the demand, then gives each factory with a free slot one job: the best value it can afford, or nothing while saving.
 */
export function planProduction(p: Plan): PlanResult {
  const factories = p.pic.mine.factory;
  const wanted = demandsFrom(p.mem.unfilled);
  const stale = cancelStale(factories, wanted);
  let open = lessQueued(wanted, queuedAfter(factories, stale.intents));
  let credits = p.pic.credits;
  const builds: Intent[] = [];
  for (const f of factories) {
    if ((stale.left.get(f.id) ?? f.queue.length) >= QUEUE_LEN) continue;
    const d = choose(open, credits);
    if (!d) break;
    const kind = armyKind(d, open, credits);
    credits -= UNIT_STATS[kind].cost;
    open = open.map((o) => (o.kind === kind ? less(o, 1) : o));
    builds.push({ t: "build", factory: f.id, kind });
  }
  return { assign: [], intents: [...stale.intents, ...builds], memory: {} };
}

function lessQueued(demands: readonly Demand[], queued: ReadonlyMap<UnitKind, number>): Demand[] {
  return demands.map((d) => less(d, queued.get(d.kind) ?? 0));
}
