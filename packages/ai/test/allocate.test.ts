import { test } from "node:test";
import assert from "node:assert/strict";
import { createWorld, generateMap, spawnUnit, type Unit, type UnitKind } from "@mf/sim";
import { ownPower } from "../src/assess/power.ts";
import { buildBoard } from "../src/board/board.ts";
import { studyMap } from "../src/terrain/study.ts";
import { KNOBS } from "../src/knobs.ts";
import { emptyMemory } from "../src/memory/memory.ts";
import { perceive } from "../src/perception/picture.ts";
import { allocate, membersOf, type Allocation, type Asked, type Held } from "../src/plans/allocate.ts";
import { PLANS } from "../src/plans/registry.ts";
import type { Request } from "../src/plans/types.ts";

/** Own units of player 0 at the given places, in spawn order. */
function units(...at: [UnitKind, number, number][]): Readonly<Unit>[] {
  const w = createWorld(generateMap(1, { width: 8000, height: 8000, cell: 125 }));
  w.features = [];
  for (const [kind, x, y] of at) spawnUnit(w, 0, kind, x, y);
  return w.units;
}

function ask(plan: string, score: number, count: number, near = { x: 0, y: 0 }, more: Partial<Request> = {}): Asked {
  return { plan, request: { role: "r", kind: "tank", count, score, near, ...more } };
}

const ids = (alloc: Allocation, own: readonly Readonly<Unit>[], plan: string) => membersOf(alloc, own, plan).map((u) => u.id);
const held = (plan: string): Held => ({ plan, role: "r" });

test("allocate: the higher score is served first", () => {
  const own = units(["tank", 100, 0], ["tank", 200, 0]);
  const { allocation } = allocate([ask("low", 1, 1), ask("high", 9, 1)], own, new Map());
  assert.deepEqual(ids(allocation, own, "high"), [own[0]!.id]);
  assert.deepEqual(ids(allocation, own, "low"), [own[1]!.id]);
});

test("allocate: nearest first", () => {
  const own = units(["tank", 5000, 0], ["tank", 1000, 0], ["tank", 3000, 0]);
  const { allocation } = allocate([ask("a", 1, 2)], own, new Map());
  assert.deepEqual(ids(allocation, own, "a"), [own[1]!.id, own[2]!.id]);
});

test("allocate: free units go before units another plan holds, and a held unit is not taken", () => {
  const own = units(["tank", 100, 0], ["tank", 4000, 0]);
  const prev = new Map([[own[0]!.id, held("b")]]);
  const { allocation, unfilled } = allocate([ask("a", 9, 2), ask("b", 1, 1)], own, prev);
  assert.deepEqual(ids(allocation, own, "a"), [own[1]!.id]);
  assert.deepEqual(ids(allocation, own, "b"), [own[0]!.id]);
  assert.equal(unfilled.length, 1);
  assert.equal(unfilled[0]!.plan, "a");
});

test("allocate: a unit stays with its plan before a nearer free one, and is freed when the plan stops asking", () => {
  const own = units(["tank", 4000, 0], ["tank", 100, 0]);
  const prev = new Map([[own[0]!.id, held("a")]]);
  assert.deepEqual(ids(allocate([ask("a", 1, 1)], own, prev).allocation, own, "a"), [own[0]!.id]);
  const { allocation } = allocate([ask("c", 1, 1)], own, prev);
  assert.deepEqual(ids(allocation, own, "c"), [own[1]!.id]);
});

test("allocate: unfilled demand is cut to what is missing, by count and by power", () => {
  const own = units(["tank", 100, 0]);
  const byCount = allocate([ask("a", 1, 3)], own, new Map()).unfilled;
  assert.equal(byCount[0]!.request.count, 2);
  const one = ownPower(own[0]!);
  const byPower = allocate([ask("a", 1, Infinity, undefined, { power: one * 2.5 })], own, new Map()).unfilled;
  assert.ok(Math.abs(byPower[0]!.request.power! - one * 1.5) < 1e-9);
  assert.deepEqual(allocate([ask("a", 1, Infinity)], own, new Map()).unfilled, []);
});

test("allocate: a power request stops once the power is met", () => {
  const own = units(["tank", 100, 0], ["tank", 200, 0], ["tank", 300, 0]);
  const { allocation, unfilled } = allocate([ask("a", 1, Infinity, undefined, { power: ownPower(own[0]!) * 1.5 })], own, new Map());
  assert.equal(ids(allocation, own, "a").length, 2);
  assert.deepEqual(unfilled, []);
});

test("allocate: ties go by unit order, and members come back in unit order", () => {
  const own = units(["tank", 3000, 2000], ["tank", 2000, 3000], ["tank", 6000, 2000]);
  const near = { x: 2000, y: 2000 };
  const first = allocate([ask("a", 1, 1, near)], own, new Map()).allocation;
  assert.deepEqual(ids(first, own, "a"), [own[0]!.id]);
  const all = allocate([ask("a", 1, Infinity, { x: 7000, y: 7000 })], own, new Map()).allocation;
  assert.deepEqual(ids(all, own, "a"), own.map((u) => u.id));
});

test("registry: each unit kind goes to its old owner, every unit, in unit order", () => {
  const world = createWorld(generateMap(2, { width: 8000, height: 8000, cell: 125 }));
  world.features = [];
  world.players.push({ id: 0, name: "p", color: 0, credits: 0, alive: true, connected: true, team: 0 });
  const kinds: UnitKind[] = ["tank", "factory", "harvester", "artillery", "engineer", "radar", "tank", "harvester", "engineer", "factory"];
  kinds.forEach((k, n) => spawnUnit(world, 0, k, 1000 + n * 300, 2000 + (n % 3) * 400));
  const pic = perceive(world, 0);
  const mem = emptyMemory(1);
  const board = buildBoard(pic, mem, KNOBS.hard, [], studyMap(world)).board;
  const asked = PLANS.flatMap((p) => p.requests(board, mem, KNOBS.hard).map((request) => ({ plan: p.id, request })));
  const { allocation } = allocate(asked, pic.own, new Map());
  const owner: Record<string, readonly Readonly<Unit>[]> = {
    base: pic.mine.factory,
    economy: pic.mine.harvester,
    army: pic.mine.tank,
    artillery: pic.mine.artillery,
    support: pic.own.filter((u) => u.kind === "engineer" || u.kind === "radar"),
  };
  for (const [plan, want] of Object.entries(owner)) assert.deepEqual(ids(allocation, pic.own, plan), want.map((u) => u.id), plan);
  assert.equal(allocation.size, pic.own.length);
});
