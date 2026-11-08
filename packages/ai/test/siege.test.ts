import { test } from "node:test";
import assert from "node:assert/strict";
import { createWorld, generateMap, spawnUnit, UNIT_STATS, type UnitKind } from "@mf/sim";
import { buildThreat } from "../src/assess/threat.ts";
import { buildBoard } from "../src/board/board.ts";
import { studyMap } from "../src/terrain/study.ts";
import { KNOBS } from "../src/knobs.ts";
import { emptyMemory, type Ghost, type Memory } from "../src/memory/memory.ts";
import { perceive } from "../src/perception/picture.ts";
import { planArmy } from "../src/plan/army.ts";
import { homeOf, type Plan } from "../src/plan/plan.ts";
import { HOLD, shouldSiege } from "../src/plan/siege.ts";

const C = { x: 5000, y: 5000 };
const RANGE = UNIT_STATS.tank.siegeRange;
const TICK = 1000;

const ghost = (kind: UnitKind | null, dx: number, lastSeen = TICK): Ghost => ({
  id: 1, owner: 1, x: C.x + dx, y: C.y, kind, mode: null, hp: null, firstSeen: 0, lastSeen,
});

test("siege: an armed enemy within tank siege range sieges an attacking or defending squad", () => {
  assert.equal(shouldSiege("attack", C, [ghost("tank", RANGE - 50)], TICK), true);
  assert.equal(shouldSiege("defend", C, [ghost("artillery", 100)], TICK), true);
  assert.equal(shouldSiege("attack", C, [ghost(null, 100)], TICK), true);
});

test("siege: no siege out of range, for an unarmed enemy, or with nothing known", () => {
  assert.equal(shouldSiege("attack", C, [ghost("tank", RANGE + 50)], TICK), false);
  assert.equal(shouldSiege("attack", C, [ghost("harvester", 100)], TICK), false);
  assert.equal(shouldSiege("attack", C, [], TICK), false);
});

test("siege: the siege holds HOLD ticks after the last sighting, then ends", () => {
  assert.equal(shouldSiege("attack", C, [ghost("tank", 100, TICK - HOLD + 1)], TICK), true);
  assert.equal(shouldSiege("attack", C, [ghost("tank", 100, TICK - HOLD)], TICK), false);
});

test("siege: a retreating or gathering squad never sieges", () => {
  assert.equal(shouldSiege("retreat", C, [ghost("tank", 100)], TICK), false);
  assert.equal(shouldSiege("gather", C, [ghost("tank", 100)], TICK), false);
});

const SITE = { x: 3000, y: 6000 };

function poolPlan(): { p: Plan; tanks: ReturnType<typeof perceive>["mine"]["tank"] } {
  const w = createWorld(generateMap(1, { width: 16000, height: 12000, cell: 125 }));
  w.features = [];
  w.fields = [];
  w.players.push({ id: 0, name: "p", color: 0, credits: 0, alive: true, connected: true, team: 0 });
  spawnUnit(w, 0, "factory", SITE.x, SITE.y);
  spawnUnit(w, 0, "tank", SITE.x + 200, SITE.y);
  const pic = perceive(w, 0);
  const mem: Memory = { ...emptyMemory(1.5), site: SITE, siteSince: -10000 };
  const board = buildBoard(pic, mem, KNOBS.normal, [], studyMap(w)).board;
  const p: Plan = { pic, mem, knobs: { ...KNOBS.normal, scout: false }, roll: () => 0.5, known: board.known, threat: buildThreat(board.known, pic.map), groups: board.groups, home: homeOf(pic, mem), board };
  return { p, tanks: pic.mine.tank };
}

test("siege: an idle pool tank drives to staging and sieges there", () => {
  const { p, tanks } = poolPlan();
  const out = planArmy(p, tanks);
  assert.deepEqual(out.assign.map((a) => a.task), [{ t: "goto", ...p.home.staging, attack: true, siege: true }]);
});
