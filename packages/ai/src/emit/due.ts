import type { Unit } from "@mf/sim";
import { within } from "../geometry.ts";
import type { Assignment } from "../memory/memory.ts";
import type { Task } from "../tasks.ts";

/** Ticks before a dropped task is sent again. Gives the sim time to act on the last intent. */
const RETRY = 30;
/** A goto with no `arrive` counts as arrived within this, plus room for the formation block of the group. */
const ARRIVE = 300;
const ROW_GAP = 60;
/** A new goto this close to the old one, same flags, is the same task. */
const GOTO_SLACK = 400;

/** The same goal: equal tasks, or two gotos with the same flags and close points. */
export function sameTask(a: Task, b: Task): boolean {
  if (a.t === "goto" && b.t === "goto") return a.attack === b.attack && a.siege === b.siege && within(a, b, GOTO_SLACK);
  if (a.t === "siege" && b.t === "siege") return a.on === b.on;
  if (a.t === "guard" && b.t === "guard") return a.target === b.target;
  if (a.t === "attack" && b.t === "attack") return a.target === b.target;
  return false;
}

/** Send now: never sent, or sent a while ago and the unit dropped it before it was done. */
export function due(u: Readonly<Unit>, a: Assignment, tick: number): boolean {
  if (a.issued < 0) return true;
  if (tick - a.issued < RETRY) return false;
  return dropped(u, a.task, a.size);
}

function dropped(u: Readonly<Unit>, task: Task, size: number): boolean {
  const idle = u.orders.length === 0;
  switch (task.t) {
    case "goto": {
      if (!idle || u.mode === "deploying" || u.mode === "packing") return false;
      const near = within(u, task, task.arrive ?? ARRIVE + ROW_GAP * Math.ceil(Math.sqrt(2 * size)));
      // Not near: the move is sent again. A replacing move packs a sieged unit first (sim `intents/move.ts`).
      return !near || (task.siege && u.mode === "mobile") || (!task.siege && u.mode === "sieged");
    }
    case "siege": return idle && u.mode === (task.on ? "mobile" : "sieged");
    case "guard": {
      const h = u.orders[0];
      return h?.type !== "guard" || h.target !== task.target;
    }
    case "attack": return idle;
  }
}
