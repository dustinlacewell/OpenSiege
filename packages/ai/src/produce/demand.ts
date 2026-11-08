import { UNIT_STATS, type UnitKind } from "@mf/sim";
import type { Asked } from "../plans/allocate.ts";

/** Units of one kind the plans asked for and did not get. `score` is in credits, for all `count` of them. */
export interface Demand {
  kind: UnitKind;
  count: number;
  score: number;
}

/** The unfilled requests, summed per kind, in the order the kinds first appear. Power-only asks are not used. */
export function demandsFrom(unfilled: readonly Asked[]): Demand[] {
  const out = new Map<UnitKind, Demand>();
  for (const { request: r } of unfilled) {
    if (!Number.isFinite(r.count) || r.count <= 0) continue;
    const d = out.get(r.kind) ?? { kind: r.kind, count: 0, score: 0 };
    out.set(r.kind, { kind: r.kind, count: d.count + r.count, score: d.score + r.score });
  }
  return [...out.values()];
}

/** Score per credit of cost, or per tick of build work, over the whole demand. */
export function valueOf(d: Demand, per: "credits" | "time" = "credits"): number {
  const s = UNIT_STATS[d.kind];
  return d.score / (d.count * (per === "credits" ? s.cost : s.buildTicks));
}

/** The demand less `n` units, each taking an equal share of the score. */
export function less(d: Demand, n: number): Demand {
  const count = Math.max(0, d.count - n);
  return { kind: d.kind, count, score: d.count > 0 ? (d.score * count) / d.count : 0 };
}
