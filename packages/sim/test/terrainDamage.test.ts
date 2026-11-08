import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createSimState, decodeWorld, detonate, encodeWorld, hashWorld, MAX_DIG, PROJ_FP, spawnUnit, stampCrater, step, UNIT_STATS,
  type Blast, type SimState, type Stamped, type Unit, type World,
} from "../src/index.ts";
import { NO_UNIT } from "../src/blast.ts";
import { buildGrid } from "../src/grid.ts";
import { mapSize } from "../src/mapSize.ts";
import { MOVE_CLASSES } from "../src/nav/moveClass.ts";
import { cachedSpec, freshState, TINY } from "./helpers.ts";
import { createSimState as mk } from "../src/simState.ts";
import { createWorld } from "../src/index.ts";

const BIG = { width: 8000, height: 8000, cell: 125 };

function bigState(seed: number): SimState {
  return mk(createWorld(structuredClone(cachedSpec(seed, BIG))));
}

/** Two close bases, each with artillery and tanks, all attack-moving at the other side. */
function battle(seed: number): { s: SimState; orders: () => Stamped[] } {
  const s = bigState(seed);
  step(s, [
    { player: 0, intent: { t: "join", name: "a", x: 3000, y: 4000 } },
    { player: 1, intent: { t: "join", name: "b", x: 3900, y: 4000 } },
  ]);
  const mine: Unit[] = [], theirs: Unit[] = [];
  for (let k = 0; k < 8; k++) {
    mine.push(spawnUnit(s.world, 0, k % 2 ? "artillery" : "tank", 3200 + k * 20, 3800 + k * 60));
    theirs.push(spawnUnit(s.world, 1, k % 2 ? "artillery" : "tank", 3700 - k * 20, 3800 + k * 60));
  }
  const orders = (): Stamped[] => {
    const alive = (us: Unit[]) => us.filter((u) => s.world.units.some((w) => w.id === u.id)).map((u) => u.id);
    const out: Stamped[] = [];
    for (const [p, us, tx] of [[0, mine, 3800], [1, theirs, 3100]] as const) {
      const ids = alive(us);
      if (ids.length) out.push({ player: p, intent: { t: "move", units: ids, x: tx, y: 4000, force: true, queue: false, attack: true } });
    }
    return out;
  };
  return { s, orders };
}

function assertNavEqual(a: SimState, b: SimState, label: string): void {
  for (const cls of MOVE_CLASSES) {
    assert.deepEqual(a.nav.grids[cls], b.nav.grids[cls], `${label}: grid ${cls}`);
    assert.deepEqual(a.nav.regions[cls], b.nav.regions[cls], `${label}: regions ${cls}`);
    assert.deepEqual(a.nav.featureBlock[cls], b.nav.featureBlock[cls], `${label}: featureBlock ${cls}`);
  }
}

const rebuild = (w: World): SimState => createSimState(decodeWorld(encodeWorld(w)));

test("claim 1: live nav equals a nav rebuilt from the encoded world, across a real battle", () => {
  for (const seed of [1, 2, 3]) {
    const { s, orders } = battle(seed);
    let dugAt = -1, boxes = 0;
    for (let t = 0; t < 500; t++) {
      step(s, t % 40 === 0 ? orders() : []);
      boxes += s.terrainDirty.length;
      if (dugAt < 0 && s.world.dug.some((d) => d > 0)) dugAt = t;
      if (t % 10 === 0) assertNavEqual(s, rebuild(s.world), `seed ${seed} tick ${t}`);
    }
    assert.ok(dugAt >= 0, `seed ${seed}: no crater ever formed`);
    console.log(`seed ${seed}: first crater tick ${dugAt}, craters ${boxes}, units left ${s.world.units.length}, dug verts ${s.world.dug.filter((d) => d > 0).length}`);
    assertNavEqual(s, rebuild(s.world), `seed ${seed} end`);
  }
});

test("claim 1: a late joiner stays in step with the live sim", () => {
  const { s, orders } = battle(1);
  const script = (t: number): Stamped[] => (t % 40 === 0 ? orders() : []);
  for (let t = 0; t < 120; t++) step(s, script(t));
  assert.ok(s.world.dug.some((d) => d > 0) || s.world.blasts.length > 0 || s.world.projectiles.length > 0);
  const late = rebuild(s.world);
  assert.equal(hashWorld(late.world), hashWorld(s.world));
  for (let t = 120; t < 400; t++) {
    const intents = script(t);
    step(s, intents);
    step(late, intents);
    assert.equal(hashWorld(late.world), hashWorld(s.world), `tick ${t}`);
    if (t % 20 === 0) assertNavEqual(s, late, `late tick ${t}`);
  }
});

test("claim 4: a snapshot taken with queued blasts detonates the same on the joiner", () => {
  const s = freshState(1, TINY);
  const a = spawnUnit(s.world, 0, "factory", 1000, 1000);
  spawnUnit(s.world, 1, "tank", 1050, 1000);
  a.hp = 0;
  step(s, []);
  assert.ok(s.world.blasts.length > 0, "death blast queued");
  const joiner = rebuild(s.world);
  step(s, []);
  step(joiner, []);
  assert.equal(hashWorld(joiner.world), hashWorld(s.world));
  assert.ok(s.world.dug.some((d) => d > 0));
  assertNavEqual(s, joiner, "after blast");
});

test("claim 4: two deaths in one tick queue in unit order, and a death-blast kill is deterministic", () => {
  const mkS = (): SimState => {
    const s = freshState(1, TINY);
    // Two unarmed dead harvesters (deathRadius 100); their scrap pushes the 1-hp tank inside both blasts.
    const a = spawnUnit(s.world, 0, "harvester", 1000, 1000);
    const b = spawnUnit(s.world, 0, "harvester", 1030, 1000);
    const c = spawnUnit(s.world, 1, "tank", 1100, 1000);
    a.hp = 0; b.hp = 0; c.hp = 1;
    return s;
  };
  const x = mkS(), y = mkS();
  step(x, []);
  step(y, []);
  assert.equal(hashWorld(x.world), hashWorld(y.world));
  assert.equal(x.world.blasts.length, 2, "both deaths queue a blast in tick 0");
  for (let i = 1; i < 4; i++) {
    step(x, []);
    step(y, []);
    assert.equal(hashWorld(x.world), hashWorld(y.world));
  }
  assert.equal(x.world.units.length, 0);
});

test("claim 3: crater at edges, corners, off-map, below ground, huge radius", () => {
  const ref = freshState(1, TINY);
  const W = 2000;
  const cases: [string, number, number, number, number, number][] = [
    ["origin", 0, 0, 0, 45, 300],
    ["far corner", W, W, 0, 45, 300],
    ["x off-map neg", -500, 1000, 0, 45, 400],
    ["y off-map big", 1000, 5000, 0, 45, 4000],
    ["z below ground", 1000, 1000, -5000, 45, 300],
    ["huge radius", 1000, 1000, 0, 45, 2000],
    ["huge radius corner", 0, 0, 0, 500, 2000],
    ["huge damage", 1000, 1000, 0, 100000, 150],
    ["tiny radius", 1000, 1000, 0, 45, 1],
    ["zero damage", 1000, 1000, 0, 0, 300],
  ];
  for (const [name, x, y, z, damage, radius] of cases) {
    const s = freshState(1, TINY);
    const blast: Blast = { x: x * PROJ_FP, y: y * PROJ_FP, z: z * PROJ_FP, damage, radius, dig: 1 + (damage % 8) };
    for (let rep = 0; rep < 12; rep++) {
      const before = s.world.terrain.heights.slice();
      const box = stampCrater(s.world.terrain, s.world.dug, blast);
      const t = s.world.terrain;
      let minI = 1e9, minJ = 1e9, maxI = -1, maxJ = -1;
      for (let v = 0; v < t.heights.length; v++) {
        const h = t.heights[v]!;
        assert.ok(Number.isInteger(h) && h >= 0, `${name}: height ${h}`);
        assert.ok(Number.isInteger(s.world.dug[v]!) && s.world.dug[v]! <= MAX_DIG && s.world.dug[v]! >= 0, `${name}: dug`);
        assert.equal(h + s.world.dug[v]!, ref.world.terrain.heights[v]!, `${name}: heights+dug conserved`);
        if (h !== before[v]) { const i = v % t.cols, j = Math.floor(v / t.cols); minI = Math.min(minI, i); maxI = Math.max(maxI, i); minJ = Math.min(minJ, j); maxJ = Math.max(maxJ, j); }
      }
      if (box) {
        assert.ok(box.i0 >= 0 && box.j0 >= 0 && box.i1 < t.cols && box.j1 < t.rows, `${name}: box in bounds`);
        assert.ok(box.i0 <= minI && box.j0 <= minJ && box.i1 >= maxI && box.j1 >= maxJ, `${name}: box covers all changes so far`);
      }
    }
  }
});

test("claim 3: box is exactly the changed vertices for one stamp", () => {
  const s = freshState(1, TINY);
  const t = s.world.terrain;
  const before = t.heights.slice();
  const blast: Blast = { x: 1010 * PROJ_FP, y: 990 * PROJ_FP, z: 0, damage: 45, radius: 300, dig: 3 };
  const box = stampCrater(t, s.world.dug, blast)!;
  let i0 = 1e9, j0 = 1e9, i1 = -1, j1 = -1;
  for (let v = 0; v < t.heights.length; v++) if (t.heights[v] !== before[v]) {
    const i = v % t.cols, j = Math.floor(v / t.cols);
    i0 = Math.min(i0, i); j0 = Math.min(j0, j); i1 = Math.max(i1, i); j1 = Math.max(j1, j);
  }
  assert.deepEqual(box, { i0, j0, i1, j1 });
});

test("claim 2: splash damage equals the old impact logic", () => {
  // Old logic, copied from git HEAD impact.ts, run on a cloned unit list.
  const mkS = (): SimState => {
    const s = freshState(1, TINY);
    for (let k = 0; k < 12; k++) spawnUnit(s.world, k % 3, k % 2 ? "tank" : "artillery", 900 + k * 25, 1000 + ((k * 37) % 90));
    return s;
  };
  for (const [damage, splash, hit] of [[45, 180, NO_UNIT], [45, 180, 3], [30, 40, 0], [15, 300, 5]] as const) {
    const b = mkS();
    const x = 1000, y = 1020;
    const hitIdx = hit;
    const g = buildGrid(b.world.units, mapSize(b.world.terrain));
    detonate(b, g, { x: x * PROJ_FP, y: y * PROJ_FP, z: 0, damage, radius: splash }, hitIdx, null, []);
    const old = mkS();
    oldImpact(old, x, y, damage, splash, hitIdx);
    assert.deepEqual(b.world.units.map((u) => u.hp), old.world.units.map((u) => u.hp), `dmg ${damage} r ${splash} hit ${hit}`);
  }
});

async function oldImpactLoader() {
  const { applyDamage } = await import("../src/damage.ts");
  const { dist2, isqrt } = await import("../src/math.ts");
  return { applyDamage, dist2, isqrt };
}
const lib = await oldImpactLoader();

function oldImpact(state: SimState, x: number, y: number, damage: number, splash: number, hit: number): void {
  const world = state.world;
  if (hit !== NO_UNIT) lib.applyDamage(world.units[hit]!, damage);
  if (splash <= 0) return;
  const grid = buildGrid(world.units, mapSize(world.terrain));
  for (const i of grid.query(x, y, splash, [])) {
    const t = world.units[i]!;
    if (i === hit || t.hp <= 0) continue;
    const d = lib.isqrt(lib.dist2(x, y, t.x, t.y));
    if (d < splash) lib.applyDamage(t, Math.floor((damage * (splash - d)) / splash));
  }
}

test("claim 5: a unit whose route is cut by a new pit still ends its move order", () => {
  for (const seed of [1, 2, 3, 4]) {
    const s = bigState(seed);
    step(s, [{ player: 0, intent: { t: "join", name: "a", x: 500, y: 500 } }]);
    const u = spawnUnit(s.world, 0, "tank", 1500, 4000);
    step(s, [{ player: 0, intent: { t: "move", units: [u.id], x: 6500, y: 4000, force: true, queue: false, attack: false } }]);
    for (let t = 0; t < 40; t++) step(s, []);
    // Cut the route with a wall of deep death blasts ahead of the tank, repeatedly, while it drives.
    let ended = -1;
    for (let t = 0; t < 1500; t++) {
      if (t % 25 === 0 && t < 400) {
        const cx = u.x + 300 + (t / 25) * 40;
        for (let k = -6; k <= 6; k++) s.world.blasts.push({ x: cx * PROJ_FP, y: (u.y + k * 130) * PROJ_FP, z: 0, damage: 500, radius: 180, dig: 8 });
      }
      step(s, []);
      const live = s.world.units.find((w) => w.id === u.id);
      if (!live) { ended = -2; break; }
      if (live.orders.length === 0) { ended = t; break; }
    }
    const fin = s.world.units.find((w) => w.id === u.id);
    console.log(`claim5 seed ${seed}: tank at ${fin?.x},${fin?.y} ended ${ended} cut cells ${MOVE_CLASSES.map((c) => s.nav.grids[c].reduce((a, b) => a + b, 0))}`);
    assert.ok(ended !== -1, `seed ${seed}: tank still holds its move order after 1500 ticks`);
    assertNavEqual(s, rebuild(s.world), `seed ${seed} claim5 nav`);
    assert.ok(s.world.dug.some((d) => d > 0));
  }
});

test("claim 5b: one pit with a way round; the tank replans and reaches (or stalls out of) its order", () => {
  for (const seed of [1, 2, 3, 4]) {
    const run = (pit: boolean): { x: number; y: number; ended: number } => {
      const s = bigState(seed);
      step(s, [{ player: 0, intent: { t: "join", name: "a", x: 500, y: 500 } }]);
      const u = spawnUnit(s.world, 0, "tank", 1500, 4000);
      step(s, [{ player: 0, intent: { t: "move", units: [u.id], x: 6500, y: 4000, force: true, queue: false, attack: false } }]);
      let ended = -1;
      for (let t = 0; t < 1500; t++) {
        if (pit && t === 20) for (let k = -5; k <= 5; k++) s.world.blasts.push({ x: (u.x + 400) * PROJ_FP, y: (4000 + k * 100) * PROJ_FP, z: 0, damage: 500, radius: 180, dig: 8 });
        step(s, []);
        const live = s.world.units.find((w) => w.id === u.id)!;
        if (live.orders.length === 0) { ended = t; break; }
      }
      const f = s.world.units.find((w) => w.id === u.id)!;
      return { x: f.x, y: f.y, ended };
    };
    const base = run(false), pit = run(true);
    console.log(`5b seed ${seed}: no pit ${JSON.stringify(base)} pit ${JSON.stringify(pit)}`);
    assert.ok(pit.ended >= 0, `seed ${seed}: order never ended`);
  }
});

test("claim 5c: a pit lengthens the route; a reachable goal must not be abandoned by the stall rule (seed 4)", () => {
  const s = bigState(4);
  step(s, [{ player: 0, intent: { t: "join", name: "a", x: 500, y: 500 } }]);
  const u = spawnUnit(s.world, 0, "tank", 1500, 4000);
  const goal = { x: 6500, y: 4000 };
  const order: Stamped = { player: 0, intent: { t: "move", units: [u.id], x: goal.x, y: goal.y, force: true, queue: false, attack: false } };
  step(s, [order]);
  for (let t = 0; t < 1500 && u.orders.length > 0; t++) {
    if (t === 20) for (let k = -5; k <= 5; k++) s.world.blasts.push({ x: (u.x + 400) * PROJ_FP, y: (4000 + k * 100) * PROJ_FP, z: 0, damage: 500, radius: 180, dig: 8 });
    step(s, []);
  }
  const stalledAt = { x: u.x, y: u.y };
  // Same sim state, fresh order from where it gave up: does a route exist?
  step(s, [order]);
  for (let t = 0; t < 1500 && u.orders.length > 0; t++) step(s, []);
  const reachable = Math.abs(u.x - goal.x) < 60 && Math.abs(u.y - goal.y) < 60;
  console.log(`5c: gave up at ${JSON.stringify(stalledAt)}; after a fresh order it is at ${u.x},${u.y}`);
  assert.ok(reachable, "goal is not reachable even from a fresh order; test premise void");
  // The claim under test: the first order itself should have got there.
  assert.ok(Math.abs(stalledAt.x - goal.x) < 60 && Math.abs(stalledAt.y - goal.y) < 60, `order ended ${JSON.stringify(stalledAt)} away from reachable goal`);
});

test("claim 1 stress: random blasts all over the map keep nav equal to a rebuild (flips, features, edges)", () => {
  let seedState = 12345;
  const rnd = (n: number): number => { seedState = (Math.imul(seedState, 1103515245) + 12345) >>> 0; return (seedState >>> 8) % n; };
  for (const seed of [1, 2]) {
    const s = bigState(seed);
    step(s, [{ player: 0, intent: { t: "join", name: "a", x: 500, y: 500 } }]);
    let flipsSeen = 0, featuresBefore = s.world.features.length;
    for (let t = 0; t < 200; t++) {
      const n = rnd(4);
      for (let k = 0; k < n; k++) {
        s.world.blasts.push({ x: (rnd(8200) - 100) * PROJ_FP, y: (rnd(8200) - 100) * PROJ_FP, z: rnd(30) * PROJ_FP, damage: [15, 45, 150, 500][rnd(4)]!, radius: [40, 90, 180, 400][rnd(4)]!, dig: 1 + rnd(8) });
      }
      const before = MOVE_CLASSES.map((c) => s.nav.grids[c].slice());
      step(s, []);
      MOVE_CLASSES.forEach((c, i) => { if (!before[i]!.every((v, q) => v === s.nav.grids[c][q])) flipsSeen++; });
      assertNavEqual(s, rebuild(s.world), `seed ${seed} tick ${t}`);
    }
    console.log(`stress seed ${seed}: flips ${flipsSeen}, features ${featuresBefore} -> ${s.world.features.length}`);
  }
});

void UNIT_STATS;
