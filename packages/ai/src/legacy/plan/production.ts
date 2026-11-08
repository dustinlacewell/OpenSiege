import { UNIT_STATS, type Intent } from "@mf/sim";
import { countKinds, nextKind } from "./mix.ts";
import type { Plan, PlanResult } from "./plan.ts";

/** Jobs a factory holds at most. A short queue keeps the mix current and credits free. */
const QUEUE_LEN = 2;

/** Each factory with a short queue gets the next kind, while credits last. A kind the bot cannot pay for waits. */
export function planProduction(p: Plan): PlanResult {
  const counts = countKinds(p);
  let credits = p.pic.credits;
  const intents: Intent[] = [];
  for (const f of p.pic.mine.factory) {
    if (f.queue.length >= QUEUE_LEN) continue;
    const kind = nextKind(p, counts, credits, UNIT_STATS.factory.cost);
    const cost = UNIT_STATS[kind].cost;
    if (credits < cost) break;
    credits -= cost;
    counts[kind]++;
    intents.push({ t: "build", factory: f.id, kind });
  }
  return { assign: [], intents, memory: {} };
}
