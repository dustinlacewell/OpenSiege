/**
 * What a planner wants one unit to do. A task is a goal, not an intent: the emitter turns it into intents
 * only when it changes or the unit drops it (`emit/emit.ts`).
 */
export type Task =
  /** Drive to a point. `attack`: fight on the way. `siege`: deploy on arrival. */
  | { t: "goto"; x: number; y: number; attack: boolean; siege: boolean }
  | { t: "siege"; on: boolean }
  | { t: "guard"; target: number }
  | { t: "attack"; target: number };

/** One unit's task, as a planner hands it over. */
export interface Assign {
  unit: number;
  task: Task;
}

/** Equal keys mean the same task. The emitter groups units with equal keys into one intent. */
export function taskKey(task: Task): string {
  switch (task.t) {
    case "goto": return `goto:${task.x},${task.y},${task.attack ? 1 : 0}${task.siege ? 1 : 0}`;
    case "siege": return `siege:${task.on ? 1 : 0}`;
    case "guard": return `guard:${task.target}`;
    case "attack": return `attack:${task.target}`;
  }
}
