import { UNIT_STATS } from "../stats.ts";
import { dist2 } from "../math.ts";
import { isBoostable, isPatient } from "../patient.ts";
import { guardPatient, guardedUnit } from "../guard.ts";
import { inReclaimReach, reclaimTarget } from "../reclaim.ts";
import { reclaimStep } from "../features/reclaim.ts";
import { workReachOf, workRateOf } from "../units.ts";
import type { Grid } from "../grid.ts";
import type { Unit, World } from "../types.ts";

/**
 * Each mobile or sieged engineer works on one target. A reclaim order with its scrap in reach comes first (`reclaim.ts`).
 * Else it heals a hurt friendly, else it speeds up a friendly factory's job (`boost.ts`). `work` names the target, 0 = none.
 * Returns the ids of the scrap that reclaim brought to 0 hp this tick, so `reap` removes them with no wreckage.
 */
export function repair(world: World, grid: Grid): ReadonlySet<number> {
  const near: number[] = [];
  const reclaimed = new Set<number>();
  for (const u of world.units) {
    if (u.kind !== "engineer") continue;
    u.work = 0;
    if (u.mode !== "mobile" && u.mode !== "sieged") continue;
    if (reclaimWork(world, u, reclaimed)) continue;
    const patient = guardPick(world, grid, u, near) ?? nearest(world, grid, u, near, isPatient);
    if (patient) {
      u.work = patient.id;
      heal(patient, workRateOf(u));
      continue;
    }
    const factory = nearest(world, grid, u, near, isBoostable);
    if (factory) u.work = factory.id;
  }
  return reclaimed;
}

function heal(t: Unit, amount: number): void {
  t.hp = Math.min(UNIT_STATS[t.kind].maxHp, t.hp + amount);
}

/**
 * Engineer `e` with a head reclaim order and its scrap in reach takes `workRate` hp off the scrap, capped by the hp left,
 * and pays the owner. True when it worked. Engineers run in id order, so a later one on the same scrap gets what is left.
 * A scrap this brings to 0 hp goes into `reclaimed`: `reap` removes it and leaves no wreckage.
 */
function reclaimWork(world: World, e: Unit, reclaimed: Set<number>): boolean {
  const f = reclaimTarget(world, e);
  if (!f || !inReclaimReach(e, f)) return false;
  e.work = f.id;
  const credits = reclaimStep(f, workRateOf(e));
  if (f.hp <= 0) reclaimed.add(f.id);
  const owner = world.players.find((p) => p.id === e.owner);
  if (owner) owner.credits += credits;
  return true;
}

/** A guarding engineer's first pick: the most hurt friendly near the unit it guards (`guard.ts`), if in reach. */
function guardPick(world: World, grid: Grid, e: Unit, near: number[]): Unit | undefined {
  const g = guardedUnit(world, e);
  const p = g && guardPatient(world, grid, e, g, near);
  const reach = workReachOf(e);
  return p && dist2(e.x, e.y, p.x, p.y) <= reach * reach ? p : undefined;
}

/** The nearest unit in reach that `fits`. The grid yields indices in order, so ties go to the lower index. */
function nearest(world: World, grid: Grid, e: Unit, near: number[], fits: (e: Unit, t: Unit) => boolean): Unit | undefined {
  const reach = workReachOf(e);
  let best: Unit | undefined;
  let bestD = reach * reach + 1;
  for (const i of grid.query(e.x, e.y, reach, near)) {
    const t = world.units[i]!;
    if (!fits(e, t)) continue;
    const d = dist2(e.x, e.y, t.x, t.y);
    if (d < bestD) { bestD = d; best = t; }
  }
  return best;
}
