import { test } from "node:test";
import assert from "node:assert/strict";
import { createWorld, generateMap, spawnUnit, type ResourceField, type World } from "@mf/sim";
import { buildThreat } from "../src/assess/threat.ts";
import { buildBoard } from "../src/board/board.ts";
import { studyMap } from "../src/terrain/study.ts";
import { KNOBS } from "../src/knobs.ts";
import { emptyMemory, type Memory } from "../src/memory/memory.ts";
import { perceive } from "../src/perception/picture.ts";
import { planBase } from "../src/plan/base.ts";
import { homeOf, type Plan } from "../src/plan/plan.ts";

const SITE = { x: 3000, y: 6000 };

/** A world with one factory on a field-poor site and the given fields. */
function world(fields: ResourceField[]): World {
  const w = createWorld(generateMap(1, { width: 16000, height: 12000, cell: 125 }));
  w.features = [];
  w.players.push({ id: 0, name: "p", color: 0, credits: 0, alive: true, connected: true, team: 0 });
  spawnUnit(w, 0, "factory", SITE.x, SITE.y);
  w.fields = fields;
  return w;
}

/** A plan for the world, the site held long enough that it may move. */
function plan(w: World): Plan {
  const pic = perceive(w, 0);
  const mem: Memory = { ...emptyMemory(1.5), site: SITE, siteSince: -10000 };
  const board = buildBoard(pic, mem, KNOBS.normal, [], studyMap(w)).board;
  return { pic, mem, knobs: KNOBS.normal, roll: () => 0.5, known: board.known, threat: buildThreat(board.known, pic.map), groups: board.groups, home: homeOf(pic, mem), board };
}

function siteOf(p: Plan): { x: number; y: number } {
  return planBase(p, p.pic.mine.factory).memory.site!;
}

const field = (id: number, x: number, y: number, amount: number): ResourceField => ({ id, x, y, radius: 300, amount });

test("base: a factory on a field-poor site stays when a rich field is near", () => {
  assert.deepEqual(siteOf(plan(world([field(1, SITE.x + 4600, SITE.y, 20000)]))), SITE);
});

test("base: a factory on a field-poor site stays when a rich field is far", () => {
  assert.deepEqual(siteOf(plan(world([field(1, 13000, SITE.y, 20000)]))), SITE);
});
