import { test } from "node:test";
import assert from "node:assert/strict";
import { createWorld, generateMap, spawnUnit, UNIT_STATS, type World } from "@mf/sim";
import type { EnemyGroup } from "../src/assess/groups.ts";
import { unitPower } from "../src/assess/power.ts";
import { buildThreat } from "../src/assess/threat.ts";
import { buildBoard } from "../src/board/board.ts";
import { studyMap } from "../src/terrain/study.ts";
import { stamp } from "../src/danger/grid.ts";
import { dist, type Point } from "../src/geometry.ts";
import { KNOBS } from "../src/knobs.ts";
import { emptyMemory, type Memory, type Squad, type SquadState } from "../src/memory/memory.ts";
import { perceive } from "../src/perception/picture.ts";
import { planBase } from "../src/plan/base.ts";
import { frontOf } from "../src/plan/front.ts";
import { homeOf, type Plan } from "../src/plan/plan.ts";

const SITE = { x: 3000, y: 6000 };
const BACKSET = UNIT_STATS.artillery.siegeRange + 800;

function world(): World {
  const w = createWorld(generateMap(1, { width: 16000, height: 12000, cell: 125 }));
  w.features = [];
  w.players.push({ id: 0, name: "p", color: 0, credits: 0, alive: true, connected: true, team: 0 });
  spawnUnit(w, 0, "factory", SITE.x, SITE.y);
  w.fields = [];
  return w;
}

const squad = (id: number, size: number, target: Point, state: SquadState = "attack", scouting = false): Squad => ({
  id,
  members: Array.from({ length: size }, (_, n) => 100 * id + n),
  state,
  goal: target,
  target,
  k: 1.5,
  scouting,
  since: 0,
});

/** A plan with the given squads, the site held long enough that it may move. */
function plan(squads: Squad[]): Plan {
  const w = world();
  const pic = perceive(w, 0);
  const mem: Memory = { ...emptyMemory(1.5), site: SITE, siteSince: -10000, squads };
  const board = buildBoard(pic, mem, KNOBS.normal, [], studyMap(w)).board;
  return { pic, mem, knobs: KNOBS.normal, roll: () => 0.5, known: board.known, threat: buildThreat(board.known, pic.map), groups: board.groups, home: homeOf(pic, mem), board };
}

const group = (at: Point): EnemyGroup => ({ at, radius: 0, power: 1, value: 1, members: [], hasFactory: false });

test("front: the target of the largest attacking squad", () => {
  const p = plan([squad(1, 3, { x: 9000, y: 3000 }), squad(2, 6, { x: 12000, y: 9000 }), squad(3, 9, { x: 5000, y: 5000 }, "gather"), squad(4, 9, { x: 7000, y: 7000 }, "attack", true)]);
  assert.deepEqual(frontOf(p), { x: 12000, y: 9000 });
});

test("front: no attack falls back to the enemy group nearest the site", () => {
  const p = { ...plan([]), groups: [group({ x: 14000, y: 6000 }), group({ x: 7000, y: 5000 })] };
  assert.deepEqual(frontOf(p), { x: 7000, y: 5000 });
});

test("front: nothing known gives no front", () => {
  assert.equal(frontOf(plan([])), undefined);
});

const siteOf = (p: Plan): Point => planBase(p, p.pic.mine.factory).memory.site!;

test("base: the factory moves to about BACKSET behind a far front", () => {
  const front = { x: 13000, y: 6000 };
  const site = siteOf(plan([squad(1, 5, front)]));
  assert.ok(Math.abs(dist(site, front) - BACKSET) < 300, `site ${JSON.stringify(site)} is ${dist(site, front)} from the front`);
  assert.ok(site.x > SITE.x);
});

test("base: a front shift under the slack does not move the factory", () => {
  const front = { x: SITE.x + BACKSET + 1500, y: SITE.y };
  assert.deepEqual(siteOf(plan([squad(1, 5, front)])), SITE);
});

test("base: the factory does not move when the road crosses danger", () => {
  const p = plan([squad(1, 5, { x: 13000, y: 6000 })]);
  stamp(p.board.danger.live, 6000, SITE.y, unitPower("tank", "mobile") * 3, 800);
  assert.deepEqual(siteOf(p), SITE);
});

test("base: staging lies between the site and the front", () => {
  const p = plan([]);
  const front = { x: 3000, y: 11000 };
  const { site, staging } = homeOf(p.pic, { ...p.mem, front });
  assert.ok(Math.abs(dist(site, staging) - 700) < 2);
  assert.ok(Math.abs(dist(site, staging) + dist(staging, front) - dist(site, front)) < 2);
});
