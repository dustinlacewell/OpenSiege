import type { Intent, Unit } from "@mf/sim";
import type { Assignment } from "../memory/memory.ts";
import { taskKey, type Assign, type Task } from "../tasks.ts";
import { due, sameTask } from "./due.ts";

/**
 * Order hygiene. Fresh tasks replace an assignment only when the goal changed. Then every due assignment is sent,
 * one intent per group of units with the same task, until `cap` intents. The rest wait for the next think.
 */
export function emit(own: readonly Readonly<Unit>[], prev: ReadonlyMap<number, Assignment>, fresh: readonly Assign[], tick: number, cap: number): { intents: Intent[]; assignments: Map<number, Assignment> } {
  const alive = new Map(own.map((u) => [u.id, u]));
  const next = merge(prev, fresh, alive);
  const intents: Intent[] = [];
  for (const [key, units] of dueGroups(next, alive, tick)) {
    const task = next.get(units[0]!)!.task;
    const out = intentsFor(task, units);
    if (intents.length + out.length > cap) break;
    intents.push(...out);
    for (const id of units) next.set(id, { task, key, issued: tick, size: units.length });
  }
  return { intents, assignments: next };
}

/** Living units keep their assignment unless a fresh task differs from it. */
function merge(prev: ReadonlyMap<number, Assignment>, fresh: readonly Assign[], alive: ReadonlyMap<number, unknown>): Map<number, Assignment> {
  const next = new Map([...prev].filter(([id]) => alive.has(id)));
  for (const { unit, task } of fresh) {
    if (!alive.has(unit)) continue;
    const old = next.get(unit);
    if (old && sameTask(old.task, task)) continue;
    next.set(unit, { task, key: taskKey(task), issued: -1, size: 1 });
  }
  return next;
}

/** Due units grouped by task key, in first-seen order. */
function dueGroups(next: ReadonlyMap<number, Assignment>, alive: ReadonlyMap<number, Readonly<Unit>>, tick: number): Map<string, number[]> {
  const groups = new Map<string, number[]>();
  for (const [id, a] of next) {
    const u = alive.get(id);
    if (!u || !due(u, a, tick)) continue;
    const list = groups.get(a.key);
    if (list) list.push(id);
    else groups.set(a.key, [id]);
  }
  return groups;
}

function intentsFor(task: Task, units: number[]): Intent[] {
  switch (task.t) {
    case "goto": {
      const move: Intent = { t: "move", units, x: task.x, y: task.y, force: true, queue: false, attack: task.attack };
      return task.siege ? [move, { t: "siege", units, on: true, queue: true }] : [move];
    }
    case "siege": return [{ t: "siege", units, on: task.on, queue: false }];
    case "guard": return [{ t: "guard", units, target: task.target, queue: false }];
    case "attack": return [{ t: "attack", units, target: task.target, queue: false }];
  }
}
