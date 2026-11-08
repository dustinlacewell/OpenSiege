import { test } from "node:test";
import assert from "node:assert/strict";
import { createWorld, generateMap, mapSize, spawnUnit, type World } from "@mf/sim";
import { buildThreat } from "../src/assess/threat.ts";
import { buildBoard } from "../src/board/board.ts";
import { studyMap } from "../src/terrain/study.ts";
import { dist } from "../src/geometry.ts";
import { KNOBS } from "../src/knobs.ts";
import { emptyMemory } from "../src/memory/memory.ts";
import { perceive } from "../src/perception/picture.ts";
import { ENGINEER_REACH } from "../src/plans/asks/buildSpeed.ts";
import { homeOf, type Plan } from "../src/plan/plan.ts";
import { planSupport } from "../src/plan/support.ts";

function world(): World {
  const w = createWorld(generateMap(1, { width: 8000, height: 8000, cell: 125 }));
  w.features = [];
  w.players.push({ id: 0, name: "p", color: 0, credits: 0, alive: true, connected: true, team: 0 });
  return w;
}

/** One support think with no squad out: every engineer is free for the factories. */
function think(w: World) {
  const pic = perceive(w, 0);
  const mem = emptyMemory(0);
  const board = buildBoard(pic, mem, KNOBS.hard, [], studyMap(w)).board;
  const plan = { pic, mem, knobs: KNOBS.hard, threat: buildThreat([], mapSize(w.terrain)), home: homeOf(pic, mem), board } as unknown as Plan;
  return planSupport(plan, pic.mine.engineer).assign;
}

/** The factory an engineer's goto keeps it in work reach of, wherever inside `arrive` it stops. */
function factoryOf(w: World, unit: number, assign: ReturnType<typeof think>) {
  const task = assign.find((a) => a.unit === unit)?.task;
  if (task?.t !== "goto") return assert.fail("expected a goto");
  assert.ok(task.siege);
  const f = w.units.filter((u) => u.kind === "factory").find((u) => dist(task, u) + task.arrive! <= ENGINEER_REACH);
  return f ?? assert.fail("no factory in reach of the spot");
}

test("an idle engineer sieges at a spot within work reach of a factory", () => {
  const w = world();
  const f = spawnUnit(w, 0, "factory", 4000, 4000);
  const e = spawnUnit(w, 0, "engineer", 2000, 2000);
  assert.equal(factoryOf(w, e.id, think(w)).id, f.id);
});

test("two engineers and two factories split one each", () => {
  const w = world();
  spawnUnit(w, 0, "factory", 3000, 4000);
  spawnUnit(w, 0, "factory", 5000, 4000);
  const a = spawnUnit(w, 0, "engineer", 2000, 2000);
  const b = spawnUnit(w, 0, "engineer", 2100, 2000);
  const assign = think(w);
  assert.notEqual(factoryOf(w, a.id, assign).id, factoryOf(w, b.id, assign).id);
});
