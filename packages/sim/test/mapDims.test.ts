import { test } from "node:test";
import assert from "node:assert/strict";
import {
  clampX, clampY, edgeMargin, hashWorld, mapCentre, mapHeight, mapSize, mapWidth, scaledCount, spawnEdge, spawnUnit, step,
  type MapParams, type MapSize, type Projectile, type SimState, type Stamped,
} from "../src/index.ts";
import { buildGrid } from "../src/grid.ts";
import { planPath } from "../src/nav/plan.ts";
import { BLOCKED } from "../src/nav/navGrid.ts";
import { labelRegions } from "../src/nav/regions.ts";
import { TALL, TINY, WIDE, freshState } from "./helpers.ts";

const WIDE_M: MapSize = { width: 24000, height: 8000 };

test("mapSize derives from the terrain", () => {
  const t = freshState(1, TINY).world.terrain;
  assert.deepEqual([mapWidth(t), mapHeight(t)], [2000, 2000]);
  assert.deepEqual(mapSize(freshState(1, WIDE).world.terrain), WIDE_M);
  assert.deepEqual(mapSize(freshState(1, TALL).world.terrain), { width: 4000, height: 12000 });
});

test("clampX and clampY use their own axis", () => {
  assert.equal(clampX(WIDE_M, 20000), 20000);
  assert.equal(clampY(WIDE_M, 20000), 8000);
  assert.equal(clampX(WIDE_M, 30000), 24000);
  assert.equal(clampX(WIDE_M, -5), 0);
  assert.equal(clampY(WIDE_M, -5), 0);
});

test("mapCentre is per axis", () => {
  assert.deepEqual(mapCentre(WIDE_M), { x: 12000, y: 4000 });
  assert.deepEqual(mapCentre({ width: 2001, height: 5 }), { x: 1000, y: 2 });
});

test("spawnEdge is 1000 on big maps and an eighth of the short side on small ones", () => {
  assert.equal(spawnEdge({ width: 16000, height: 16000 }), 1000);
  assert.equal(spawnEdge(WIDE_M), 1000);
  assert.equal(spawnEdge({ width: 2000, height: 2000 }), 250);
  assert.equal(spawnEdge({ width: 24000, height: 2000 }), 250);
  assert.equal(edgeMargin(600, { width: 2000, height: 2000 }), 250);
  assert.equal(edgeMargin(100, { width: 2000, height: 2000 }), 100);
});

test("scaledCount is exact at the reference area and scales with area", () => {
  const ref = { width: 16000, height: 16000 };
  assert.equal(scaledCount(40, ref), 40);
  assert.equal(scaledCount(7, ref), 7);
  assert.equal(scaledCount(40, WIDE_M), 30);
  assert.equal(scaledCount(40, { width: 8000, height: 8000 }), 10);
  assert.equal(scaledCount(40, { width: 2000, height: 2000 }), 0);
  assert.equal(scaledCount(1000, { width: 2000, height: 2000 }), 15);
});

function inBounds(s: SimState, m: MapSize): void {
  assert.ok(s.world.units.length > 0);
  for (const u of s.world.units) {
    assert.ok(Number.isFinite(u.x) && Number.isFinite(u.y) && Number.isFinite(u.hp), `unit ${u.id} finite`);
    assert.ok(u.x >= 0 && u.x <= m.width, `unit ${u.id} x ${u.x}`);
    assert.ok(u.y >= 0 && u.y <= m.height, `unit ${u.id} y ${u.y}`);
  }
}

const join = (player: number, x: number, y: number): Stamped => ({ player, intent: { t: "join", name: `p${player}`, x, y } });
const moveAll = (s: SimState, player: number, x: number, y: number): Stamped => ({
  player,
  intent: { t: "move", units: s.world.units.filter((u) => u.owner === player && u.kind === "harvester").map((u) => u.id), x, y, force: true, queue: false, attack: false },
});

function run(p: MapParams, a: [number, number], b: [number, number], goal: [number, number]): number[] {
  const s = freshState(1, p);
  const m = mapSize(s.world.terrain);
  step(s, [join(1, ...a), join(2, ...b)]);
  step(s, [moveAll(s, 1, ...goal), moveAll(s, 2, ...goal)]);
  const hashes: number[] = [];
  for (let t = s.world.tick; t < 300; t++) {
    step(s, []);
    if (t % 100 === 99) {
      inBounds(s, m);
      hashes.push(hashWorld(s.world));
    }
  }
  assert.equal(hashes.length, 3);
  assert.equal(s.world.units.filter((u) => u.owner === 1 && u.kind === "harvester").length > 0, true);
  return hashes;
}

test("wide map sim stays in bounds and is deterministic", () => {
  const a = run(WIDE, [2000, 4000], [22000, 6000], [22000, 4000]);
  assert.deepEqual(run(WIDE, [2000, 4000], [22000, 6000], [22000, 4000]), a);
  assert.equal(new Set(a).size, 3);
});

test("tall map sim stays in bounds and is deterministic", () => {
  const a = run(TALL, [2000, 2000], [2000, 10000], [2000, 11000]);
  assert.deepEqual(run(TALL, [2000, 2000], [2000, 10000], [2000, 11000]), a);
});

function targetOf(p: MapParams, x: number, y: number): { x: number; y: number } {
  const s = freshState(1, p);
  step(s, [join(1, 3000, 3000)]);
  const h = s.world.units.find((u) => u.kind === "harvester")!;
  step(s, [{ player: 1, intent: { t: "move", units: [h.id], x, y, force: true, queue: false, attack: false } }]);
  const o = h.orders[0]!;
  assert.equal(o.type, "move");
  return o.type === "move" ? { x: o.x, y: o.y } : { x: -1, y: -1 };
}

test("move past the short side clamps to the height", () => {
  const t = targetOf(WIDE, 12000, 9000);
  assert.ok(t.y <= 8000, `y ${t.y}`);
  assert.ok(t.x > 11000, `x ${t.x}`);
});

test("move past the short side along the long axis does not clamp", () => {
  const t = targetOf(WIDE, 12000, 4000);
  assert.ok(t.x > 11000 && t.x <= 24000, `x ${t.x}`);
});

test("move past the long side clamps to the width", () => {
  assert.ok(targetOf(WIDE, 30000, 4000).x <= 24000);
  assert.ok(targetOf(TALL, 3900, 9000).y > 8000);
  assert.ok(targetOf(TALL, 9000, 9000).x <= 4000);
});

test("planPath across the long axis stays inside the map", () => {
  const s = freshState(1, WIDE);
  const path = planPath(s.nav, "light", { x: 500, y: 4000 }, { x: 23500, y: 4000 });
  assert.ok(path.length > 0);
  for (const p of path) assert.ok(p.x >= 0 && p.x <= 24000 && p.y >= 0 && p.y <= 8000, `${p.x},${p.y}`);
  const last = path[path.length - 1]!;
  assert.ok(last.x > 20000);
});

test("planPath across the tall axis stays inside the map", () => {
  const s = freshState(1, TALL);
  const path = planPath(s.nav, "heavy", { x: 2000, y: 500 }, { x: 2000, y: 11500 });
  for (const p of path) assert.ok(p.x >= 0 && p.x <= 4000 && p.y >= 0 && p.y <= 12000, `${p.x},${p.y}`);
  assert.ok(path[path.length - 1]!.y > 9000);
});

test("regions on a non-square grid label every open cell and no blocked cell", () => {
  for (const p of [WIDE, TALL]) {
    const s = freshState(1, p);
    const cells = s.nav.shape.cols * s.nav.shape.rows;
    for (const cls of ["light", "heavy"] as const) {
      const grid = s.nav.grids[cls], labels = labelRegions(s.nav.shape, grid);
      assert.equal(grid.length, cells);
      assert.equal(labels.length, cells);
      let open = 0, max = 0;
      for (let c = 0; c < cells; c++) {
        if (grid[c] === BLOCKED) assert.equal(labels[c], 0);
        else { open++; assert.ok(labels[c]! > 0); }
        if (labels[c]! > max) max = labels[c]!;
      }
      assert.ok(open > 0 && max <= cells);
      assert.deepEqual(labels, s.nav.regions[cls]);
    }
  }
});

test("unit grid finds units at the far corners of the long axis", () => {
  const s = freshState(1, WIDE);
  spawnUnit(s.world, 1, "tank", 23900, 100);
  spawnUnit(s.world, 1, "tank", 100, 7900);
  spawnUnit(s.world, 1, "tank", 12000, 4000);
  const units = s.world.units, g = buildGrid(units, WIDE_M);
  const hit = (x: number, y: number) => g.query(x, y, 300, []).map((i) => units[i]!).filter((u) => Math.abs(u.x - x) < 300 && Math.abs(u.y - y) < 300);
  assert.equal(hit(23900, 100).length, 1);
  assert.equal(hit(100, 7900).length, 1);
  assert.equal(hit(12000, 4000).length, 1);
  assert.equal(g.query(23900, 100, 300, []).length, 1);
  assert.equal(g.query(100, 7900, 300, []).length, 1);
});

function shell(x: number, y: number, vx: number, vy: number): Projectile {
  return { id: 99, owner: 1, shooter: 0, source: "artillery", x: x * 16, y: y * 16, z: 6000 * 16, vx: vx * 16, vy: vy * 16, vz: 0, damage: 10, splash: 100, dig: 0, ttl: 50 };
}

function flyOne(p: Projectile): number {
  const s = freshState(1, WIDE, (spec) => { spec.features = []; });
  s.world.projectiles.push(p);
  step(s, []);
  return s.world.projectiles.length;
}

test("a shell leaving through the short side is removed", () => {
  assert.equal(flyOne(shell(4000, 7900, 0, 200)), 0);
  assert.equal(flyOne(shell(4000, 100, 0, -200)), 0);
});

test("a shell flying along the long axis past the short-side length is kept", () => {
  assert.equal(flyOne(shell(10000, 4000, 200, 0)), 1);
  assert.equal(flyOne(shell(10000, 4000, 0, 200)), 1);
});

test("a shell leaving through the long side is removed", () => {
  assert.equal(flyOne(shell(23900, 4000, 200, 0)), 0);
});
