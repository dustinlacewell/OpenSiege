import { MAX_ORDERS, MAX_QUEUE, UNIT_STATS, type Intent, type Unit, type UnitKind, type UnitMode, type World } from "@mf/sim";
import { chainFrom, scrapsInCircle } from "./areaReclaim.ts";
import { playerById, unitById } from "./lookup.ts";

/** `force` packs up sieged units; `queue` appends to each unit's orders instead of replacing them. */
export interface CommandMods {
  force: boolean;
  queue: boolean;
}

/** Right-click: attack the enemy under the cursor, else move to the ground point. */
export function commandAt(
  selected: readonly number[],
  enemy: Unit | undefined,
  x: number,
  y: number,
  mods: CommandMods,
): Intent | null {
  if (selected.length === 0) return null;
  const units = [...selected];
  if (enemy) return { t: "attack", units, target: enemy.id, queue: mods.queue };
  return moveTo(units, x, y, mods, false);
}

/** Attack-move mode left click: drive to the ground point, fighting whatever comes in reach on the way. */
export function attackMoveAt(selected: readonly number[], x: number, y: number, mods: CommandMods): Intent | null {
  return selected.length === 0 ? null : moveTo([...selected], x, y, mods, true);
}

function moveTo(units: number[], x: number, y: number, mods: CommandMods, attack: boolean): Intent {
  return { t: "move", units, x: Math.round(x), y: Math.round(y), force: mods.force, queue: mods.queue, attack };
}

/** Right-drag curve: a move whose spots spread along `path`. Needs 2 or more points; (x, y) is the last one. */
export function pathMove(selected: readonly number[], path: readonly { x: number; y: number }[], mods: CommandMods): Intent | null {
  const end = path[path.length - 1];
  if (selected.length === 0 || path.length < 2 || !end) return null;
  return {
    t: "move", units: [...selected], x: end.x, y: end.y, force: mods.force, queue: mods.queue, attack: false,
    path: path.map((p) => ({ x: p.x, y: p.y })),
  };
}

/**
 * Siege on if any selected unit is mobile, else siege off.
 * When queued, "mobile" means the mode the unit will have once its queued siege orders have run.
 */
export function siegeToggle(world: World, selected: readonly number[], queue: boolean): Extract<Intent, { t: "siege" }> | null {
  const units = selectedUnits(world, selected);
  if (units.length === 0) return null;
  const on = units.some((u) => (queue ? projectedMode(u) : u.mode) === "mobile");
  return { t: "siege", units: units.map((u) => u.id), on, queue };
}

function projectedMode(u: Unit): UnitMode {
  for (let i = u.orders.length - 1; i >= 0; i--) {
    const o = u.orders[i]!;
    if (o.type === "siege") return o.on ? "sieged" : "mobile";
  }
  return u.mode;
}

/** Guard the unit `target`. The target itself drops out of the guards. Null with no other unit selected. */
export function guard(selected: readonly number[], target: number, queue: boolean): Intent | null {
  const units = selected.filter((id) => id !== target);
  return units.length === 0 ? null : { t: "guard", units, target, queue };
}

/** Reclaim the scrap `target` with the selected own engineers. Other selected units get nothing. Null when no own engineer is selected. */
export function reclaim(
  world: World, me: number, selected: readonly number[], target: number, queue: boolean,
): Extract<Intent, { t: "reclaim" }> | null {
  const units = ownEngineers(world, me, selected).map((u) => u.id);
  return units.length === 0 ? null : { t: "reclaim", units, target, queue };
}

/**
 * Area reclaim: the selected own engineers reclaim every scrap whose centre is in the circle, one intent per wreck.
 * The wrecks form a nearest-neighbour chain from the first selected engineer, at most MAX_ORDERS long.
 * The first intent has `queue`; the rest queue after it. Other selected units get nothing. Empty with no own engineer.
 */
export function areaReclaim(
  world: World, me: number, selected: readonly number[], x: number, y: number, radius: number, queue: boolean,
): Extract<Intent, { t: "reclaim" }>[] {
  const engineers = ownEngineers(world, me, selected);
  const lead = engineers[0];
  if (!lead) return [];
  const units = engineers.map((u) => u.id);
  const chain = chainFrom(scrapsInCircle(world.features, x, y, radius), lead.x, lead.y, MAX_ORDERS);
  return chain.map((f, i) => ({ t: "reclaim", units, target: f.id, queue: i === 0 ? queue : true }));
}

/** True when the selection holds an own engineer. */
export function hasEngineer(world: World, me: number, selected: readonly number[]): boolean {
  return ownEngineers(world, me, selected).length > 0;
}

function ownEngineers(world: World, me: number, selected: readonly number[]): Unit[] {
  return selectedUnits(world, selected).filter((u) => u.owner === me && u.kind === "engineer");
}

export function stop(selected: readonly number[]): Intent | null {
  return selected.length === 0 ? null : { t: "stop", units: [...selected] };
}

/** Jobs one Shift+build or Shift+cancel handles. */
export const BATCH = 5;

/**
 * Up to `count` build intents per selected own factory: as many as fit its queue
 * and the player's credits, spent factory by factory.
 */
export function build(world: World, me: number, selected: readonly number[], kind: UnitKind, count = 1): Intent[] {
  const cost = UNIT_STATS[kind].cost;
  let credits = playerById(world.players, me)?.credits ?? 0;
  const out: Intent[] = [];
  for (const f of ownFactories(world, me, selected)) {
    const n = Math.max(0, Math.min(count, MAX_QUEUE - f.queue.length, Math.floor(credits / cost)));
    for (let i = 0; i < n; i++) out.push({ t: "build", factory: f.id, kind });
    credits -= n * cost;
  }
  return out;
}

/**
 * One `cancel` for the last of `jobs` (ids, queue order) of an own factory. With `many`, the last
 * BATCH of them. Ids keep their job even when the queue shifts, so a late cancel never hits the wrong job.
 */
export function cancelJobs(world: World, me: number, factory: number, jobs: readonly number[], many: boolean): Intent | null {
  const f = unitById(world.units, factory);
  const pick = jobs.slice(-(many ? BATCH : 1));
  if (!f || f.owner !== me || pick.length === 0) return null;
  return { t: "cancel", factory, jobs: pick };
}

/** One `quota` intent per selected own factory: change its quota for `kind` by `delta`. The sim clamps. */
export function quota(world: World, me: number, selected: readonly number[], kind: UnitKind, delta: number): Intent[] {
  return ownFactories(world, me, selected).map((f) => ({ t: "quota", factory: f.id, kind, delta }));
}

/** Rally point for the selected own factories. Null when none is selected. */
export function rallyAt(world: World, me: number, selected: readonly number[], x: number, y: number): Intent | null {
  const units = ownFactories(world, me, selected).map((f) => f.id);
  return units.length === 0 ? null : { t: "rally", units, x: Math.round(x), y: Math.round(y) };
}

export function ownFactories(world: World, me: number, selected: readonly number[]): Unit[] {
  return selectedUnits(world, selected).filter((u) => u.owner === me && u.kind === "factory");
}

function selectedUnits(world: World, selected: readonly number[]): Unit[] {
  const out: Unit[] = [];
  for (const id of selected) {
    const u = unitById(world.units, id);
    if (u) out.push(u);
  }
  return out;
}
