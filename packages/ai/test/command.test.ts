import { test } from "node:test";
import assert from "node:assert/strict";
import { createWorld, generateMap, spawnUnit, type UnitKind, type World } from "@mf/sim";
import { buildBoard } from "../src/board/board.ts";
import { studyMap } from "../src/terrain/study.ts";
import { command } from "../src/command/command.ts";
import { commandContext } from "../src/command/context.ts";
import { fieldGoals } from "../src/command/field.ts";
import { protectGoals } from "../src/command/protect.ts";
import { KNOBS } from "../src/knobs.ts";
import { emptyMemory, type Ghost, type Memory } from "../src/memory/memory.ts";
import { perceive } from "../src/perception/picture.ts";
import { factoryWorth } from "../src/worth/unit.ts";

function world(): World {
  const w = createWorld(generateMap(1, { width: 12000, height: 12000, cell: 125 }));
  w.features = [];
  w.players.push({ id: 0, name: "p", color: 0, credits: 0, alive: true, connected: true, team: 0 });
  return w;
}

/** Enemy ghosts seen long ago, so they are past the reaction delay. */
function withGhosts(...gs: [UnitKind, number, number][]): Memory {
  const ghosts = new Map<number, Ghost>(gs.map(([kind, x, y], n) => [9000 + n, { id: 9000 + n, owner: 1, x, y, kind, mode: "mobile", hp: null, firstSeen: -1000, lastSeen: 0 }]));
  return { ...emptyMemory(1.5), ghosts };
}

function context(w: World, mem: Memory) {
  const board = buildBoard(perceive(w, 0), mem, KNOBS.normal, [], studyMap(w)).board;
  return { board, c: commandContext(board, KNOBS.normal) };
}

test("command: a rich safe field scores above a dangerous one", () => {
  const w = world();
  spawnUnit(w, 0, "factory", 6000, 6000);
  spawnUnit(w, 0, "tank", 9000, 3000);
  w.fields = [
    { id: 100, x: 3000, y: 3000, radius: 300, amount: 5000 },
    { id: 101, x: 9000, y: 3000, radius: 300, amount: 5000 },
  ];
  const { c } = context(w, withGhosts(["tank", 9000, 3000]));
  const goals = fieldGoals(c);
  const safe = goals.find((g) => g.id === "field:100")!;
  const risky = goals.find((g) => g.id === "field:101")!;
  assert.ok(safe.score > 0);
  assert.equal(safe.need.count, 3);
  assert.ok(risky.score < safe.score);
});

test("command: a lone factory with an enemy group beside it has a protect score near its whole worth", () => {
  const w = world();
  spawnUnit(w, 0, "factory", 3000, 3000);
  const { c } = context(w, withGhosts(["tank", 3500, 3000], ["tank", 3600, 3100], ["tank", 3500, 3200], ["tank", 3400, 3100]));
  const [g] = protectGoals(c);
  assert.ok(g!.score > 0.99 * factoryWorth(c.own.lifePremium));
  assert.ok(g!.need.power! > 0);
});

test("command: insurance protects a factory at tick 0 with no enemy known", () => {
  const w = world();
  spawnUnit(w, 0, "factory", 3000, 3000);
  const { c } = context(w, emptyMemory(1.5));
  assert.ok(c.insurance > 0);
  const [g] = protectGoals(c);
  assert.ok(g!.score > 0);
  assert.ok(g!.need.power! > 0);
});

test("command: a goal active in the last run gets the hysteresis bonus", () => {
  const w = world();
  spawnUnit(w, 0, "factory", 3000, 3000);
  const { board } = context(w, emptyMemory(1.5));
  const first = command(board, emptyMemory(1.5), KNOBS.normal);
  const again = command(board, { ...emptyMemory(1.5), goals: first }, KNOBS.normal);
  const a = first.find((g) => g.kind === "protect")!;
  const b = again.find((g) => g.id === a.id)!;
  assert.ok(Math.abs(b.score - a.score * 1.15) < 1e-6);
});
