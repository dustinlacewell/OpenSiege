import { test } from "node:test";
import assert from "node:assert/strict";
import { createWorld, generateMap, spawnUnit, type Unit, type UnitKind } from "@mf/sim";
import { approaches } from "../src/board/approaches.ts";
import { buildBoard } from "../src/board/board.ts";
import { studyMap } from "../src/terrain/study.ts";
import { NO_EVENTS, releaseEvents } from "../src/board/delay.ts";
import { hurtEvents, type LastHp } from "../src/board/hurt.ts";
import { emptyGrid, stamp } from "../src/danger/grid.ts";
import { emptyScar } from "../src/danger/scar.ts";
import { KNOBS } from "../src/knobs.ts";
import { emptyMemory } from "../src/memory/memory.ts";
import { perceive } from "../src/perception/picture.ts";

const MAP = { width: 16000, height: 16000 };

const unit = (id: number, kind: UnitKind, x: number, y: number, hp: number) => ({ id, owner: 0, kind, x, y, hp, mode: "mobile" }) as Unit;
const last = (hp: number, tick: number, x = 0, y = 0): LastHp => ({ hp, x, y, kind: "tank", tick, rate: 0 });

test("hurtEvents: an hp drop is a hurt with its rate over the gap", () => {
  const r = hurtEvents(new Map([[1, last(100, 10)]]), [unit(1, "tank", 500, 600, 60)], 20);
  assert.deepEqual(r.hurts, [{ id: 1, kind: "tank", x: 500, y: 600, amount: 40, rate: 4, tick: 20 }]);
  assert.equal(r.losses.length, 0);
  assert.equal(r.nextHp.get(1)!.rate, 4);
});

test("hurtEvents: a missing unit is a loss at its last place, with its last drop's rate", () => {
  const r = hurtEvents(new Map([[1, { ...last(100, 10, 700, 800), rate: 3 }]]), [], 20);
  assert.deepEqual(r.losses, [{ id: 1, kind: "tank", x: 700, y: 800, rate: 3, tick: 20 }]);
  assert.equal(r.nextHp.size, 0);
});

test("hurtEvents: repair is no event", () => {
  const r = hurtEvents(new Map([[1, last(50, 10)]]), [unit(1, "tank", 0, 0, 80)], 20);
  assert.equal(r.hurts.length + r.losses.length, 0);
  assert.equal(r.nextHp.get(1)!.hp, 80);
});

test("reaction delay: events wait until they are old enough", () => {
  const fresh = { hurts: [{ id: 1, kind: "tank" as const, x: 0, y: 0, amount: 10, rate: 1, tick: 100 }], losses: [] };
  const early = releaseEvents(NO_EVENTS, fresh, 100, 30);
  assert.equal(early.ready.hurts.length, 0);
  const still = releaseEvents(early.pending, NO_EVENTS, 129, 30);
  assert.equal(still.ready.hurts.length, 0);
  const late = releaseEvents(still.pending, NO_EVENTS, 130, 30);
  assert.equal(late.ready.hurts.length, 1);
  assert.equal(late.pending.hurts.length, 0);
});

test("approaches point at a danger blob, and have no direction without danger", () => {
  const factory = unit(1, "factory", 8200, 8200, 100);
  const harvester = unit(2, "harvester", 4200, 4200, 100);
  const fields = [{ id: 50, x: 4200, y: 4200, radius: 300, amount: 5000 }];
  const live = emptyGrid(MAP);
  stamp(live, 10200, 8200, 10, 800);
  const [f, h] = approaches([factory, harvester], fields, { live, scar: emptyScar(MAP) });
  assert.equal(f!.at, "factory");
  assert.ok(f!.dir!.x > 0.99);
  assert.equal(h!.at, "field");
  assert.equal(h!.dir, null);
});

test("buildBoard on a generated 2v2 world: allies come through, enemies do not", () => {
  const world = createWorld(generateMap(3, { width: 8000, height: 8000, cell: 125 }));
  world.features = [];
  for (const [id, team] of [[0, 0], [1, 0], [2, 1], [3, 1]] as const) {
    world.players.push({ id, name: `p${id}`, color: 0, credits: 0, alive: true, connected: true, team });
  }
  spawnUnit(world, 0, "factory", 2000, 2000);
  spawnUnit(world, 0, "tank", 2200, 2000);
  spawnUnit(world, 1, "tank", 2400, 2000);
  spawnUnit(world, 2, "tank", 6000, 6000);
  spawnUnit(world, 3, "tank", 2600, 2000);
  const pic = perceive(world, 0);
  const { board, memory } = buildBoard(pic, emptyMemory(1), KNOBS.hard, [], studyMap(world));
  assert.deepEqual(board.allies.map((a) => a.owner), [1]);
  assert.equal(board.fields.length, world.fields.length);
  assert.equal(board.approaches.filter((a) => a.at === "factory").length, 1);
  assert.equal(memory.lastHp.size, 2);
  assert.ok(memory.scar);
  assert.equal(memory.scarTick, pic.tick);
});
