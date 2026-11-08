import { test } from "node:test";
import assert from "node:assert/strict";
import { createWorld, generateMap, spawnUnit } from "@mf/sim";
import { due } from "../src/emit/due.ts";
import { taskKey, type Task } from "../src/tasks.ts";

/** A sieged harvester with no orders, `off` units from the goto point at (2000, 2000). */
function sieged(off: number) {
  const w = createWorld(generateMap(1, { width: 4000, height: 4000, cell: 125 }));
  const u = spawnUnit(w, 0, "harvester", 2000 + off, 2000);
  u.mode = "sieged";
  u.orders = [];
  return u;
}

const task: Task = { t: "goto", x: 2000, y: 2000, attack: false, siege: true, arrive: 340 };
const sent = { task, key: taskKey(task), issued: 0, size: 1 };

test("a goto with siege is sent again to a unit sieged outside its arrive distance", () => {
  assert.equal(due(sieged(400), sent, 100), true);
});

test("a goto with siege is not sent again to a unit sieged inside its arrive distance", () => {
  assert.equal(due(sieged(300), sent, 100), false);
});

test("arrive is part of the task key, so units with different arrive distances are not grouped", () => {
  assert.notEqual(taskKey(task), taskKey({ ...task, arrive: 80 }));
});
