import type { Intent, Unit, UnitKind } from "@mf/sim";
import type { Demand } from "./demand.ts";

/**
 * Queued jobs past the demand for their kind, from the back of each queue, as cancel intents (a cancel refunds the full cost).
 * The head job of a queue is never cancelled: its progress would be lost. `left`: jobs per factory after the cancels.
 */
export function cancelStale(factories: readonly Readonly<Unit>[], demands: readonly Demand[]): { intents: Intent[]; left: Map<number, number> } {
  const excess = excessByKind(factories, demands);
  const intents: Intent[] = [];
  const left = new Map<number, number>();
  for (const f of [...factories].reverse()) {
    const jobs: number[] = [];
    for (let n = f.queue.length - 1; n >= 1; n--) {
      const j = f.queue[n]!;
      if ((excess.get(j.kind) ?? 0) <= 0) continue;
      excess.set(j.kind, excess.get(j.kind)! - 1);
      jobs.push(j.id);
    }
    if (jobs.length > 0) intents.push({ t: "cancel", factory: f.id, jobs });
    left.set(f.id, f.queue.length - jobs.length);
  }
  return { intents, left };
}

/** Per kind: queued jobs less the demand. */
function excessByKind(factories: readonly Readonly<Unit>[], demands: readonly Demand[]): Map<UnitKind, number> {
  const out = new Map<UnitKind, number>();
  for (const f of factories) for (const j of f.queue) out.set(j.kind, (out.get(j.kind) ?? 0) + 1);
  for (const [kind, n] of out) out.set(kind, n - (demands.find((d) => d.kind === kind)?.count ?? 0));
  return out;
}

/** Jobs of each kind still queued once `cancelled` is taken out. */
export function queuedAfter(factories: readonly Readonly<Unit>[], cancelled: readonly Intent[]): Map<UnitKind, number> {
  const gone = new Set(cancelled.flatMap((i) => (i.t === "cancel" ? i.jobs : [])));
  const out = new Map<UnitKind, number>();
  for (const f of factories) for (const j of f.queue) if (!gone.has(j.id)) out.set(j.kind, (out.get(j.kind) ?? 0) + 1);
  return out;
}
