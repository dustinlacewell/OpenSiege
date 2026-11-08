import { FIELD_AMOUNT, type ResourceField, type Unit } from "@mf/sim";
import { powerWithin } from "../assess/power.ts";
import { threatAt } from "../assess/threat.ts";
import { dist, type Point } from "../geometry.ts";
import type { Assign } from "../tasks.ts";
import type { Plan, PlanResult } from "./plan.ts";

/** A harvester claims a field only with at least this much left. */
const CLAIM_MIN = 400;
/** A harvester with no other field to go to stays until its own is empty. */
const EMPTY = 1;
/** Enemy power, net of own guards, a field may have on it and still be worked. */
const SAFE_LIMIT = 15;
/** Own armed units this close to a field guard it. */
const GUARD_REACH = 1500;
const GUARD_SHARE = 0.7;
/** Harvesters per field. More drain it faster for no gain in rate. */
const PER_FIELD = 1;
/** Distance scales in the field score: from the harvester, and from the factory site. */
const NEAR_HARVESTER = 3000;
const NEAR_SITE = 5000;
/** Second and later harvesters on one field stand this far apart. */
const SLOT_GAP = 220;

/** Each harvester works the best safe field it can claim, deployed. With none, it waits at staging. */
export function planEconomy(p: Plan): PlanResult {
  const harvesters = p.pic.mine.harvester;
  const fields = new Map(p.pic.fields.map((f) => [f.id, f]));
  const claims = new Map<number, number[]>();
  const keep = keptClaims(p, harvesters, fields, claims);
  for (const h of harvesters) {
    if (keep.has(h.id)) continue;
    const f = bestField(p, h, claims) ?? drainedField(p, h, fields, claims);
    if (!f) continue;
    keep.set(h.id, f.id);
    claimOn(claims, f.id).push(h.id);
  }
  return { assign: tasksFor(p, harvesters, keep, fields, claims), intents: [], memory: { harvest: keep } };
}

/** Harvesters whose field has at least `leaveBelow` left and is safe keep it. */
function keptClaims(p: Plan, harvesters: readonly Readonly<Unit>[], fields: Map<number, ResourceField>, claims: Map<number, number[]>): Map<number, number> {
  const keep = new Map<number, number>();
  for (const h of harvesters) {
    const f = fields.get(p.mem.harvest.get(h.id) ?? -1);
    if (!f || !workable(p, f, p.knobs.leaveBelow)) continue;
    keep.set(h.id, f.id);
    claimOn(claims, f.id).push(h.id);
  }
  return keep;
}

/** The harvester's old field when it is low but not empty, safe, and no other field is free: it stays and takes what refills. */
function drainedField(p: Plan, h: Readonly<Unit>, fields: Map<number, ResourceField>, claims: Map<number, number[]>): ResourceField | undefined {
  const f = fields.get(p.mem.harvest.get(h.id) ?? -1);
  return f && (claims.get(f.id)?.length ?? 0) === 0 && workable(p, f, EMPTY) ? f : undefined;
}

function bestField(p: Plan, h: Readonly<Unit>, claims: Map<number, number[]>): ResourceField | undefined {
  let best: ResourceField | undefined;
  let bestScore = -Infinity;
  for (const f of p.pic.fields) {
    if ((claims.get(f.id)?.length ?? 0) >= PER_FIELD || !workable(p, f, CLAIM_MIN)) continue;
    const score = (f.amount / FIELD_AMOUNT) / (1 + dist(h, f) / NEAR_HARVESTER + dist(p.home.site, f) / NEAR_SITE);
    if (score > bestScore) {
      bestScore = score;
      best = f;
    }
  }
  return best;
}

function workable(p: Plan, f: ResourceField, minAmount: number): boolean {
  if (f.amount < minAmount) return false;
  const guard = powerWithin(p.pic.own, f, GUARD_REACH) * GUARD_SHARE;
  return threatAt(p.threat, f) - guard <= SAFE_LIMIT;
}

function tasksFor(p: Plan, harvesters: readonly Readonly<Unit>[], keep: Map<number, number>, fields: Map<number, ResourceField>, claims: Map<number, number[]>): Assign[] {
  return harvesters.map((h) => {
    const f = fields.get(keep.get(h.id) ?? -1);
    if (!f) return { unit: h.id, task: { t: "goto", ...p.home.staging, attack: false, siege: false } };
    const spot = slot(f, (claims.get(f.id) ?? []).indexOf(h.id));
    return { unit: h.id, task: { t: "goto", ...spot, attack: false, siege: true } };
  });
}

function slot(f: ResourceField, n: number): Point {
  if (n <= 0) return { x: f.x, y: f.y };
  const a = n * 2.4;
  return { x: Math.round(f.x + Math.cos(a) * SLOT_GAP), y: Math.round(f.y + Math.sin(a) * SLOT_GAP) };
}

function claimOn(claims: Map<number, number[]>, field: number): number[] {
  let list = claims.get(field);
  if (!list) claims.set(field, (list = []));
  return list;
}
