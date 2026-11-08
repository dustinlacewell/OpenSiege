import { test } from "node:test";
import assert from "node:assert/strict";
import { createSimState, hashWorld, spawnUnit, step, UNIT_STATS, type Feature, type SimState, type UnitKind } from "../src/index.ts";
import { MOVE_CLASSES } from "../src/nav/moveClass.ts";
import { createNavState } from "../src/nav/navState.ts";
import { freshState, TINY } from "./helpers.ts";

/** A map with no features, so the only feature is what a death leaves. */
const bare = (): SimState => freshState(1, TINY, (spec) => { spec.features = []; });

/** Kill one unit of `kind` at (1000, 1000) and run one tick. */
function killOne(s: SimState, kind: UnitKind): void {
  spawnUnit(s.world, 0, kind, 1000, 1000).hp = 0;
  step(s, []);
}

const leftBehind = (s: SimState): Feature => {
  assert.equal(s.world.features.length, 1);
  return s.world.features[0]!;
};

/** The nav must equal one built fresh from the world's features. */
function assertNavFresh(s: SimState): void {
  const fresh = createNavState(s.world.terrain, s.world.features);
  for (const cls of MOVE_CLASSES) {
    assert.deepEqual(s.nav.featureBlock[cls], fresh.featureBlock[cls]);
    assert.deepEqual(s.nav.grids[cls], fresh.grids[cls]);
    assert.deepEqual(s.nav.regions[cls], fresh.regions[cls]);
  }
}

test("a dead tank leaves scrap with its scrapHp and its radius", () => {
  const s = bare();
  killOne(s, "tank");
  const f = leftBehind(s);
  assert.equal(f.kind, "scrap");
  assert.equal(f.unit, "tank");
  assert.equal(f.hp, UNIT_STATS.tank.scrapHp);
  assert.ok(f.hp > 0);
  assert.equal(f.radius, UNIT_STATS.tank.radius);
  assert.deepEqual([f.x, f.y], [1000, 1000]);
  assert.equal(s.world.units.length, 0);
  assert.deepEqual(s.features.query(1000, 1000, 0, []), [f]);
});

for (const kind of ["radar", "mine"] as const) {
  test(`a dead ${kind} leaves wreckage and the nav stays as it was`, () => {
    const s = bare();
    const before = createNavState(s.world.terrain, []);
    killOne(s, kind);
    const f = leftBehind(s);
    assert.equal(f.kind, "wreckage");
    assert.equal(f.unit, kind);
    assert.equal(f.hp, 0);
    assert.equal(f.radius, UNIT_STATS[kind].radius);
    for (const cls of MOVE_CLASSES) assert.deepEqual(s.nav.grids[cls], before.grids[cls]);
    assertNavFresh(s);
  });
}

test("scrap blocks nav cells, and when destroyed it becomes wreckage and the cells open", () => {
  const s = bare();
  const open = createNavState(s.world.terrain, []);
  killOne(s, "tank");
  assertNavFresh(s);
  for (const cls of MOVE_CLASSES) assert.notDeepEqual(s.nav.grids[cls], open.grids[cls], `${cls} grid sees the scrap`);

  const scrap = leftBehind(s);
  scrap.hp = 0;
  step(s, []);
  const wreck = leftBehind(s);
  assert.equal(wreck.kind, "wreckage");
  assert.equal(wreck.unit, "tank");
  assert.equal(wreck.radius, scrap.radius);
  assert.deepEqual([wreck.x, wreck.y], [scrap.x, scrap.y]);
  assert.ok(wreck.id > scrap.id);
  assert.deepEqual(s.features.query(1000, 1000, 0, []), [wreck]);
  assertNavFresh(s);
});

test("scrap stays while it has hp", () => {
  const s = bare();
  killOne(s, "tank");
  const id = leftBehind(s).id;
  for (let i = 0; i < 5; i++) step(s, []);
  assert.equal(s.world.features.length, 1);
  assert.equal(s.world.features[0]!.id, id);
  assert.equal(s.world.features[0]!.kind, "scrap");
});

test("wreckage cannot be destroyed", () => {
  const s = bare();
  killOne(s, "radar");
  s.world.features[0]!.hp = -50;
  step(s, []);
  assert.equal(s.world.features.length, 1);
  assert.equal(s.world.features[0]!.kind, "wreckage");
});

test("the same deaths give the same hash every tick", () => {
  const run = (): SimState => {
    const s = bare();
    spawnUnit(s.world, 0, "tank", 1000, 1000).hp = 0;
    spawnUnit(s.world, 1, "radar", 1400, 1000).hp = 0;
    spawnUnit(s.world, 1, "artillery", 600, 1200).hp = 0;
    return s;
  };
  const a = run(), b = run();
  for (let i = 0; i < 4; i++) {
    step(a, []);
    step(b, []);
    assert.equal(hashWorld(a.world), hashWorld(b.world));
    if (i === 1) for (const f of a.world.features) if (f.kind === "scrap") f.hp = 0;
    if (i === 1) for (const f of b.world.features) if (f.kind === "scrap") f.hp = 0;
  }
  assert.ok(a.world.features.some((f) => f.kind === "wreckage"));
});

test("the hash sees which unit a feature came from", () => {
  const a = bare(), b = bare();
  killOne(a, "radar");
  killOne(b, "radar");
  assert.equal(hashWorld(a.world), hashWorld(b.world));
  b.world.features[0]!.unit = "mine";
  assert.notEqual(hashWorld(a.world), hashWorld(b.world));
  delete b.world.features[0]!.unit;
  assert.notEqual(hashWorld(a.world), hashWorld(b.world));
});

test("a nav rebuilt from the world matches after scrap and wreckage are in it", () => {
  const s = bare();
  spawnUnit(s.world, 0, "tank", 1000, 1000).hp = 0;
  spawnUnit(s.world, 0, "factory", 1500, 1500).hp = 0;
  step(s, []);
  assertNavFresh(s);
  assert.deepEqual(createSimState(s.world).nav.grids.heavy, s.nav.grids.heavy);
});
