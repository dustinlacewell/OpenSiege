import type { Unit } from "@mf/sim";
import { ownPower } from "../assess/power.ts";
import { dist2 } from "../geometry.ts";
import type { Request } from "./types.ts";

/** The plan and role a unit is given to. */
export interface Held {
  plan: string;
  role: string;
}

/** Unit id to the plan that holds it. */
export type Allocation = ReadonlyMap<number, Held>;

/** One plan's request. */
export interface Asked {
  plan: string;
  request: Request;
}

/**
 * May `by` take `unit` from the plan that holds it? This is where switch cost and protected plan states go
 * (`docs/future-work/ai-hierarchy/allocation.md`, rules 3 and 4). Today a held unit is never taken.
 */
export type Steal = (unit: Readonly<Unit>, holder: Held, by: Asked) => boolean;

export const noSteal: Steal = () => false;

/**
 * Gives each own unit to at most one plan. Requests go highest score first. Each takes its own units from the last
 * allocation first, then free units, then units another plan holds if `steal` allows; nearest first, then `own`
 * order. A unit is held while its plan still asks for its kind in the same role. `unfilled` lists the requests
 * that ran out of units, cut down to what is missing.
 */
export function allocate(asked: readonly Asked[], own: readonly Readonly<Unit>[], prev: Allocation, steal: Steal = noSteal): { allocation: Map<number, Held>; unfilled: Asked[] } {
  const holders = stillHeld(asked, own, prev);
  const allocation = new Map<number, Held>();
  const unfilled: Asked[] = [];
  for (const a of byScore(asked)) {
    const short = fill(a, rank(a, own, holders, allocation, steal), allocation);
    if (short) unfilled.push(short);
  }
  return { allocation, unfilled };
}

/** The units a plan was given, in `own` order. */
export function membersOf(allocation: Allocation, own: readonly Readonly<Unit>[], plan: string): Readonly<Unit>[] {
  return own.filter((u) => allocation.get(u.id)?.plan === plan);
}

/** Last allocation, kept only where the holding plan still asks for that kind in that role. */
function stillHeld(asked: readonly Asked[], own: readonly Readonly<Unit>[], prev: Allocation): Map<number, Held> {
  const asks = new Set(asked.map((a) => askKey(a.plan, a.request.role, a.request.kind)));
  const out = new Map<number, Held>();
  for (const u of own) {
    const h = prev.get(u.id);
    if (h && asks.has(askKey(h.plan, h.role, u.kind))) out.set(u.id, h);
  }
  return out;
}

/** Highest score first. The sort is stable, so equal scores keep the order they were asked in. */
function byScore(asked: readonly Asked[]): Asked[] {
  return [...asked].sort((a, b) => b.request.score - a.request.score);
}

/** The units this request may take, best first: its own, then free, then stealable; nearest first, then `own` order. */
function rank(a: Asked, own: readonly Readonly<Unit>[], holders: ReadonlyMap<number, Held>, given: ReadonlyMap<number, Held>, steal: Steal): Readonly<Unit>[] {
  const out: { u: Readonly<Unit>; tier: number; d: number; n: number }[] = [];
  own.forEach((u, n) => {
    if (u.kind !== a.request.kind || given.has(u.id)) return;
    const tier = tierOf(u, a, holders.get(u.id), steal);
    if (tier !== undefined) out.push({ u, tier, d: dist2(u, a.request.near), n });
  });
  out.sort((x, y) => x.tier - y.tier || x.d - y.d || x.n - y.n);
  return out.map((c) => c.u);
}

/** 0: this plan holds it. 1: free. 2: another plan holds it and `steal` allows. undefined: not available. */
function tierOf(u: Readonly<Unit>, a: Asked, holder: Held | undefined, steal: Steal): number | undefined {
  if (!holder) return 1;
  if (holder.plan === a.plan && holder.role === a.request.role) return 0;
  return steal(u, holder, a) ? 2 : undefined;
}

/** Takes units until the count or the power is met. Returns what is still missing; nothing when met, or when an unbounded count has no power to reach. */
function fill(a: Asked, candidates: readonly Readonly<Unit>[], allocation: Map<number, Held>): Asked | undefined {
  const { count, power } = a.request;
  let taken = 0;
  let sum = 0;
  for (const u of candidates) {
    if (taken >= count || (power !== undefined && sum >= power)) break;
    allocation.set(u.id, { plan: a.plan, role: a.request.role });
    taken++;
    sum += ownPower(u);
  }
  if (taken >= count) return undefined;
  if (power !== undefined) return sum >= power ? undefined : { plan: a.plan, request: { ...a.request, count: count - taken, power: power - sum } };
  return count === Infinity ? undefined : { plan: a.plan, request: { ...a.request, count: count - taken } };
}

function askKey(plan: string, role: string, kind: string): string {
  return `${plan}|${role}|${kind}`;
}
