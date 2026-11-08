import { test } from "node:test";
import assert from "node:assert/strict";
import { hashWorld, spawnUnit, step, UNIT_STATS, type Feature, type Intent, type Player, type SimState, type Unit, type UnitKind } from "../src/index.ts";
import { reclaimStep, scrapValue } from "../src/features/reclaim.ts";
import { freshState, TINY } from "./helpers.ts";

/** A map with no features, so the only feature is what a death leaves. */
const bare = (): SimState => freshState(1, TINY, (spec) => { spec.features = []; });

/** Add player `id` with no credits. */
function addPlayer(s: SimState, id: number): Player {
  const p: Player = { id, name: `p${id}`, color: 0, credits: 0, alive: true, connected: true, team: -id };
  s.world.players.push(p);
  return p;
}

/** Kill one unit of `kind` at (1000, 1000) and return what it left. The second tick sets off its death blast. */
function wreckOf(s: SimState, kind: UnitKind): Feature {
  spawnUnit(s.world, 0, kind, 1000, 1000).hp = 0;
  step(s, []);
  step(s, []);
  assert.equal(s.world.features.length, 1);
  return s.world.features[0]!;
}

const reclaimIntent = (units: Unit[], target: number): Intent => ({ t: "reclaim", units: units.map((u) => u.id), target, queue: false });

/** Run ticks until the scrap `id` is gone, at most `max`. Returns the ticks run. */
function runUntilGone(s: SimState, id: number, max: number): number {
  let n = 0;
  while (s.world.features.some((f) => f.id === id) && n < max) {
    step(s, []);
    n++;
  }
  return n;
}

test("an engineer next to a tank scrap drains it at workRate, is paid scrapValue in total, and no wreckage is left", () => {
  const s = bare();
  const p = addPlayer(s, 0);
  const scrap = wreckOf(s, "tank");
  scrap.hp = UNIT_STATS.tank.scrapHp; // undo its own death blast
  const e = spawnUnit(s.world, 0, "engineer", 1150, 1000);
  step(s, [{ player: 0, intent: reclaimIntent([e], scrap.id) }]);
  assert.equal(e.work, scrap.id);
  assert.equal(scrap.hp, UNIT_STATS.tank.scrapHp - UNIT_STATS.engineer.workRate);
  runUntilGone(s, scrap.id, 1000);
  assert.equal(p.credits, Math.floor(UNIT_STATS.tank.cost / 2));
  assert.equal(s.world.features.length, 0);
  assert.deepEqual(s.features.query(1000, 1000, 0, []), []);
  step(s, []);
  assert.equal(e.orders.length, 0);
});

test("a reclaimed scrap vanishes with no wreckage, while a shelled scrap in the same tick leaves wreckage", () => {
  const s = bare();
  addPlayer(s, 0);
  const reclaimedScrap = wreckOf(s, "tank");
  reclaimedScrap.hp = 1; // one engineer step takes the last hp
  spawnUnit(s.world, 1, "tank", 2000, 2000).hp = 0;
  step(s, []);
  step(s, []);
  const shelled = s.world.features.find((f) => f.id !== reclaimedScrap.id)!;
  assert.equal(shelled.kind, "scrap");
  shelled.hp = 0; // zeroed without reclaim
  const e = spawnUnit(s.world, 0, "engineer", 1150, 1000);
  step(s, [{ player: 0, intent: reclaimIntent([e], reclaimedScrap.id) }]);
  assert.equal(s.world.features.length, 1);
  const left = s.world.features[0]!;
  assert.equal(left.kind, "wreckage");
  assert.deepEqual([left.x, left.y], [2000, 2000]);
  assert.deepEqual(s.features.query(1000, 1000, 0, []), []);
});

test("a damaged scrap pays less in proportion", () => {
  const s = bare();
  const p = addPlayer(s, 0);
  const scrap = wreckOf(s, "tank");
  scrap.hp = Math.floor(UNIT_STATS.tank.scrapHp * 2 / 5);
  const start = scrap.hp;
  const e = spawnUnit(s.world, 0, "engineer", 1150, 1000);
  step(s, [{ player: 0, intent: reclaimIntent([e], scrap.id) }]);
  runUntilGone(s, scrap.id, 1000);
  assert.equal(p.credits, scrapValue("tank", start));
  assert.ok(p.credits < scrapValue("tank", UNIT_STATS.tank.scrapHp));
  assert.ok(p.credits > 0);
});

test("two engineers on one scrap are paid exactly scrapValue of the start hp", () => {
  const s = bare();
  const p = addPlayer(s, 0);
  const scrap = wreckOf(s, "artillery");
  const start = scrap.hp;
  const a = spawnUnit(s.world, 0, "engineer", 1150, 1000);
  const b = spawnUnit(s.world, 0, "engineer", 850, 1000);
  step(s, [{ player: 0, intent: reclaimIntent([a, b], scrap.id) }]);
  assert.equal(scrap.hp, start - 2 * UNIT_STATS.engineer.workRate);
  runUntilGone(s, scrap.id, 1000);
  assert.equal(p.credits, scrapValue("artillery", start));
});

test("reclaimStep caps at the hp left and its steps sum to scrapValue", () => {
  const f: Feature = { id: 1, kind: "scrap", x: 0, y: 0, radius: 10, hp: 101, variant: 0, unit: "tank" };
  let paid = 0;
  while (f.hp > 0) paid += reclaimStep(f, 7);
  assert.equal(f.hp, 0);
  assert.equal(paid, scrapValue("tank", 101));
});

test("a non-engineer, a wreckage target and a missing id get no order", () => {
  const s = bare();
  addPlayer(s, 0);
  const scrap = wreckOf(s, "tank");
  const tank = spawnUnit(s.world, 0, "tank", 1500, 1500);
  step(s, [{ player: 0, intent: reclaimIntent([tank], scrap.id) }]);
  assert.equal(tank.orders.length, 0);

  const e = spawnUnit(s.world, 0, "engineer", 1500, 500);
  step(s, [{ player: 0, intent: reclaimIntent([e], 99999) }]);
  assert.equal(e.orders.length, 0);

  scrap.hp = 0;
  step(s, []);
  const wreck = s.world.features[0]!;
  assert.equal(wreck.kind, "wreckage");
  step(s, [{ player: 0, intent: reclaimIntent([e], wreck.id) }]);
  assert.equal(e.orders.length, 0);
});

test("an engineer out of reach drives to the scrap, then works", () => {
  const s = bare();
  addPlayer(s, 0);
  const scrap = wreckOf(s, "tank");
  const start = scrap.hp;
  const e = spawnUnit(s.world, 0, "engineer", 1700, 1000);
  step(s, [{ player: 0, intent: reclaimIntent([e], scrap.id) }]);
  assert.equal(e.work, 0);
  assert.equal(scrap.hp, start);
  let n = 0;
  while (e.work !== scrap.id && n++ < 200) step(s, []);
  assert.equal(e.work, scrap.id);
  assert.ok(e.x < 1700 - 300, "it drove toward the scrap");
  assert.ok(scrap.hp < start);
});

test("a scrap destroyed by other means ends the order", () => {
  const s = bare();
  const p = addPlayer(s, 0);
  const scrap = wreckOf(s, "tank");
  const e = spawnUnit(s.world, 0, "engineer", 1700, 1000);
  step(s, [{ player: 0, intent: reclaimIntent([e], scrap.id) }]);
  assert.equal(e.orders.length, 1);
  scrap.hp = 0;
  step(s, []);
  assert.equal(e.orders.length, 0);
  assert.equal(p.credits, 0);
  assert.equal(s.world.features[0]!.kind, "wreckage");
});

test("the hash sees the reclaim order and its target", () => {
  const make = (): { s: SimState; e: Unit; scrap: Feature } => {
    const s = bare();
    addPlayer(s, 0);
    const scrap = wreckOf(s, "tank");
    const e = spawnUnit(s.world, 0, "engineer", 1700, 1000);
    return { s, e, scrap };
  };
  const a = make(), b = make();
  assert.equal(hashWorld(a.s.world), hashWorld(b.s.world));
  b.e.orders.push({ type: "reclaim", target: b.scrap.id });
  assert.notEqual(hashWorld(a.s.world), hashWorld(b.s.world));
  a.e.orders.push({ type: "reclaim", target: a.scrap.id + 1 });
  assert.notEqual(hashWorld(a.s.world), hashWorld(b.s.world));
});
