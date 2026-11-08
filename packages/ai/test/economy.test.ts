import { test } from "node:test";
import assert from "node:assert/strict";
import { createWorld, generateMap, mapSize, spawnUnit, type World } from "@mf/sim";
import { buildThreat } from "../src/assess/threat.ts";
import { unitPower } from "../src/assess/power.ts";
import { buildBoard } from "../src/board/board.ts";
import { studyMap } from "../src/terrain/study.ts";
import { cellIndex } from "../src/danger/grid.ts";
import type { Difficulty } from "../src/index.ts";
import { KNOBS } from "../src/knobs.ts";
import { emptyMemory } from "../src/memory/memory.ts";
import { perceive } from "../src/perception/picture.ts";
import { planEconomy } from "../src/plan/economy.ts";
import { homeOf, type Plan } from "../src/plan/plan.ts";

/** A bot with one harvester midway between two fields, 2000 apart. */
function world(): World {
  const w = createWorld(generateMap(1, { width: 8000, height: 4000, cell: 125 }));
  w.features = [];
  w.players.push({ id: 0, name: "p", color: 0, credits: 0, alive: true, connected: true, team: 0 });
  spawnUnit(w, 0, "factory", 4000, 400);
  spawnUnit(w, 0, "harvester", 4000, 2000);
  w.fields = [
    { id: 100, x: 3000, y: 2000, radius: 300, amount: 5000 },
    { id: 101, x: 5000, y: 2000, radius: 300, amount: 5000 },
  ];
  return w;
}

/** Danger to add to the live grid, at a point. */
type Hot = { x: number; y: number; power: number };

/** One economy think. `harvest` is the harvester-to-field memory from the last think. */
function think(w: World, harvest: ReadonlyMap<number, number>, level: Difficulty = "hard", hot: readonly Hot[] = []) {
  const pic = perceive(w, 0);
  const mem = { ...emptyMemory(0), harvest };
  const board = buildBoard(pic, mem, KNOBS[level], [], studyMap(w)).board;
  for (const d of hot) board.danger.live.values[cellIndex(board.danger.live, d.x, d.y)] += d.power;
  const plan = { pic, mem, knobs: KNOBS[level], threat: buildThreat([], mapSize(w.terrain)), home: homeOf(pic, mem), board } as unknown as Plan;
  return planEconomy(plan, pic.mine.harvester).memory.harvest!;
}

/** The tasks of one economy think. */
function tasks(w: World, harvest: ReadonlyMap<number, number>) {
  const pic = perceive(w, 0);
  const mem = { ...emptyMemory(0), harvest };
  const board = buildBoard(pic, mem, KNOBS.hard, [], studyMap(w)).board;
  const plan = { pic, mem, knobs: KNOBS.hard, threat: buildThreat([], mapSize(w.terrain)), home: homeOf(pic, mem), board } as unknown as Plan;
  return planEconomy(plan, pic.mine.harvester).assign;
}

/** The harvester, the field it claims first, and the other field. */
function claimed(w: World) {
  const harvester = w.units.find((u) => u.kind === "harvester")!;
  const first = think(w, new Map()).get(harvester.id)!;
  return { harvester, first, other: w.fields.find((f) => f.id !== first)!, field: w.fields.find((f) => f.id === first)! };
}

test("hard: a harvester leaves a field that fell under the claim level when another field is free", () => {
  const w = world();
  const { harvester, first, field } = claimed(w);
  field.amount = 390;
  assert.notEqual(think(w, new Map([[harvester.id, first]])).get(harvester.id), first);
});

test("a harvester stays on a low field when no other field is free", () => {
  const w = world();
  const { harvester, first, field, other } = claimed(w);
  field.amount = 390;
  other.amount = 399;
  assert.equal(think(w, new Map([[harvester.id, first]])).get(harvester.id), first);
});

test("easy: a harvester sits on its field until it is empty, even with a full field free", () => {
  const w = world();
  const { harvester, first, field } = claimed(w);
  field.amount = 20;
  assert.equal(think(w, new Map([[harvester.id, first]]), "easy").get(harvester.id), first);
  field.amount = 0;
  assert.notEqual(think(w, new Map([[harvester.id, first]]), "easy").get(harvester.id), first);
});

test("a harvester leaves a field once it is empty", () => {
  const w = world();
  const { harvester, first, field } = claimed(w);
  field.amount = 0;
  assert.notEqual(think(w, new Map([[harvester.id, first]])).get(harvester.id), first);
});

test("a field far from the factory scores the same as one near it, at equal harvester distance", () => {
  const w = createWorld(generateMap(1, { width: 16000, height: 4000, cell: 125 }));
  w.features = [];
  w.players.push({ id: 0, name: "p", color: 0, credits: 0, alive: true, connected: true, team: 0 });
  spawnUnit(w, 0, "factory", 2000, 2000);
  const harvester = spawnUnit(w, 0, "harvester", 8000, 2000);
  // Ties go to the first field in the list, so the far field first proves it has no penalty.
  w.fields = [
    { id: 100, x: 11000, y: 2000, radius: 300, amount: 5000 },
    { id: 101, x: 5000, y: 2000, radius: 300, amount: 5000 },
  ];
  assert.equal(think(w, new Map()).get(harvester.id), 100);
});

test("a field with danger on it loses to an equal field without", () => {
  const w = world();
  const { harvester, first, field } = claimed(w);
  const hot = [{ x: field.x, y: field.y, power: unitPower("tank", "mobile") }];
  assert.notEqual(think(w, new Map(), "hard", hot).get(harvester.id), first);
});

test("a harvester's goto counts as done only inside the field disc", () => {
  const w = world();
  w.fields[0]!.radius = 500;
  w.fields[1]!.radius = 500;
  const task = tasks(w, new Map())[0]?.task;
  if (task?.t !== "goto") return assert.fail("expected a goto");
  assert.ok(task.siege);
  const f = w.fields.find((x) => x.x === task.x && x.y === task.y)!;
  assert.ok(task.arrive !== undefined && task.arrive > 0 && task.arrive < f.radius);
});

test("an empty field is not claimed until it has refilled to the claim level", () => {
  const w = world();
  w.fields[0]!.amount = 399;
  w.fields[1]!.amount = 399;
  assert.equal(think(w, new Map()).size, 0);
});
