import { test } from "node:test";
import assert from "node:assert/strict";
import { createWorld, generateMap, spawnUnit, type Unit, type UnitKind } from "@mf/sim";
import { buildBoard } from "../src/board/board.ts";
import { studyMap } from "../src/terrain/study.ts";
import { KNOBS } from "../src/knobs.ts";
import { emptyMemory } from "../src/memory/memory.ts";
import { perceive } from "../src/perception/picture.ts";
import { supportAsks } from "../src/plans/asks/support.ts";
import { armyKind } from "../src/produce/armyKind.ts";
import { choose } from "../src/produce/choose.ts";
import type { Demand } from "../src/produce/demand.ts";
import { cancelStale } from "../src/produce/stale.ts";

const demand = (kind: UnitKind, count: number, score: number): Demand => ({ kind, count, score });

test("produce: the best value per credit goes first", () => {
  const d = choose([demand("tank", 4, 1000), demand("harvester", 1, 1500)], 500);
  assert.equal(d?.kind, "harvester");
});

test("produce: an unaffordable best is saved for, unless a cheaper one is worth half its value", () => {
  assert.equal(choose([demand("factory", 1, 45000), demand("tank", 1, 250)], 1000), undefined);
  assert.equal(choose([demand("factory", 1, 45000), demand("tank", 1, 1500)], 1000)?.kind, "tank");
});

test("produce: with a rich bank, value goes per build tick", () => {
  assert.equal(choose([demand("factory", 1, 12000), demand("tank", 2, 1500)], 10000)?.kind, "factory");
});

test("produce: army demands build whichever army kind has more missing", () => {
  const open = [demand("tank", 2, 500), demand("artillery", 5, 2000)];
  assert.equal(armyKind(open[0]!, open, 1000), "artillery");
  assert.equal(armyKind(open[0]!, open, 300), "tank");
});

test("produce: queued jobs no demand wants are cancelled from the back; the head job stays", () => {
  const f = { id: 7, kind: "factory", queue: [{ id: 1, kind: "tank", progress: 10 }, { id: 2, kind: "tank", progress: 0 }, { id: 3, kind: "harvester", progress: 0 }] } as unknown as Unit;
  const r = cancelStale([f], [demand("tank", 1, 100)]);
  assert.deepEqual(r.intents, [{ t: "cancel", factory: 7, jobs: [3, 2] }]);
  assert.equal(r.left.get(7), 1);
  assert.deepEqual(cancelStale([{ ...f, queue: [f.queue[0]!] }], []).intents, []);
});

test("produce: engineer demand follows income less build speed", () => {
  const w = createWorld(generateMap(1, { width: 8000, height: 8000, cell: 125 }));
  w.features = [];
  w.players.push({ id: 0, name: "p", color: 0, credits: 0, alive: true, connected: true, team: 0 });
  w.fields = [
    { id: 100, x: 2000, y: 2000, radius: 300, amount: 5000 },
    { id: 101, x: 5000, y: 2000, radius: 300, amount: 5000 },
  ];
  const sieged = (kind: UnitKind, x: number, y: number): void => void (spawnUnit(w, 0, kind, x, y).mode = "sieged");
  sieged("factory", 4000, 5000);
  sieged("harvester", 2000, 2000);
  sieged("harvester", 5000, 2000);
  const engineers = (level: "easy" | "normal"): number => {
    const mem = emptyMemory(1.5);
    return supportAsks(buildBoard(perceive(w, 0), mem, KNOBS[level], [], studyMap(w)).board, mem, KNOBS[level])[0]!.count;
  };
  // Income 10, build speed 4: 3 engineers close the gap.
  assert.equal(engineers("normal"), 3);
  // One sieged engineer at the factory: build speed 6, so 2 more, 3 in all.
  sieged("engineer", 4200, 5000);
  assert.equal(engineers("normal"), 3);
  // A mobile harvester in a field adds 1: a gap of 5 wants 3 more.
  spawnUnit(w, 0, "harvester", 2100, 2000);
  assert.equal(engineers("normal"), 4);
  assert.equal(engineers("easy"), 0);
});
