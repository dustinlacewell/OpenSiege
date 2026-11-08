import { UNIT_KINDS } from "../stats.ts";
import { enqueueJob } from "../jobs.ts";
import type { Player, Unit, UnitKind, World } from "../types.ts";

/**
 * Tops up the queue of each living factory that has a quota. Per kind, in `UNIT_KINDS` order,
 * at most one job a tick: queued when the owner's living units of that kind plus this factory's
 * queued jobs of that kind are below the quota. `enqueueJob` checks credits and the free slot.
 */
export function fillQuotas(world: World): void {
  for (const f of world.units) {
    if (f.kind !== "factory" || f.hp <= 0) continue;
    const owner = world.players.find((p) => p.id === f.owner);
    if (owner) fillQuota(world, owner, f);
  }
}

function fillQuota(world: World, owner: Player, f: Unit): void {
  for (const k of UNIT_KINDS) {
    const want = f.quota[k] ?? 0;
    if (want > 0 && livingOf(world, owner.id, k) + queuedOf(f, k) < want) enqueueJob(world, owner, f, k);
  }
}

function livingOf(world: World, owner: number, kind: UnitKind): number {
  let n = 0;
  for (const u of world.units) if (u.owner === owner && u.kind === kind && u.hp > 0) n++;
  return n;
}

function queuedOf(f: Unit, kind: UnitKind): number {
  let n = 0;
  for (const j of f.queue) if (j.kind === kind) n++;
  return n;
}
