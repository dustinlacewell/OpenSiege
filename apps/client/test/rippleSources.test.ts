import { test } from "node:test";
import assert from "node:assert/strict";
import { PROJ_FP, TICK_MS, UNIT_STATS, type Projectile, type Unit, type World } from "@mf/sim";
import type { PrevPose } from "../src/game/interp.ts";
import { emitSplash, emitWakes, RippleSources, SPLASH_MAX_DEPTH, type RippleSight, type SplatSink } from "../src/game/rippleSources.ts";

interface Splat { x: number; y: number; radius: number; height: number; foam: number }

const ALL: RippleSight = { sees: () => true, shows: () => true };
const NONE: RippleSight = { sees: () => false, shows: () => false };

function sink(): SplatSink & { out: Splat[] } {
  const out: Splat[] = [];
  return { out, splat: (x, y, radius, height, foam) => out.push({ x, y, radius, height, foam }) };
}

/** Flat ground at 0 over 0..2000. seaLevel 60 is all water; 0 is all land. */
function world(seaLevel: number, units: Unit[] = []): World {
  const terrain = { cols: 3, rows: 3, cell: 1000, heights: new Array(9).fill(0), seaLevel };
  return { tick: 0, terrain, units, projectiles: [], blasts: [] } as unknown as World;
}

function tank(id: number, x: number, y: number): Unit {
  return { id, kind: "tank", owner: 0, x, y } as Unit;
}

const pose = (x: number, y: number): PrevPose => ({ x, y, facing: 0, aim: 0, elevation: 0 });

test("a moving unit in water leaves a wake at its interpolated centre", () => {
  const s = sink();
  emitWakes(world(60, [tank(1, 600, 500)]), new Map([[1, pose(500, 500)]]), 0.5, 1 / 60, ALL, s);
  assert.equal(s.out.length, 1);
  const w = s.out[0]!;
  assert.equal(w.x, 550);
  assert.equal(w.y, 500);
  assert.equal(w.radius, UNIT_STATS.tank.radius);
  assert.ok(w.height < 0, "the hull pushes the water down");
  assert.ok(w.foam > 0 && w.foam <= 1);
});

test("a wake grows with speed and with the frame's seconds", () => {
  const at = (dx: number, dt: number) => {
    const s = sink();
    emitWakes(world(60, [tank(1, 500 + dx, 500)]), new Map([[1, pose(500, 500)]]), 1, dt, ALL, s);
    return s.out[0]!.height;
  };
  assert.ok(at(20, 0.016) < at(10, 0.016));
  assert.ok(Math.abs(at(10, 0.032) - 2 * at(10, 0.016)) < 1e-9);
});

test("no wake on land, when still, without a previous pose, unseen, or with no elapsed time", () => {
  const moving = new Map([[1, pose(500, 500)]]);
  const cases: [World, ReadonlyMap<number, PrevPose>, RippleSight, number][] = [
    [world(0, [tank(1, 600, 500)]), moving, ALL, 0.016],
    [world(60, [tank(1, 500, 500)]), moving, ALL, 0.016],
    [world(60, [tank(1, 600, 500)]), new Map(), ALL, 0.016],
    [world(60, [tank(1, 600, 500)]), moving, NONE, 0.016],
    [world(60, [tank(1, 600, 500)]), moving, ALL, 0],
  ];
  for (const [w, prev, sight, dt] of cases) {
    const s = sink();
    emitWakes(w, prev, 1, dt, sight, s);
    assert.equal(s.out.length, 0);
  }
});

test("wake speed reads per tick displacement in world units per second", () => {
  const s = sink();
  const step = (5 * TICK_MS) / 1000;
  emitWakes(world(60, [tank(1, 500 + step, 500)]), new Map([[1, pose(500, 500)]]), 1, 1, ALL, s);
  assert.equal(s.out.length, 1, "5 world units per second is the threshold");
});

test("a splash in water pushes the surface down by its radius, capped", () => {
  const s = sink();
  emitSplash(world(60).terrain, 500, 500, 0, 100, ALL, s);
  emitSplash(world(60).terrain, 500, 500, 0, 1000, ALL, s);
  assert.equal(s.out.length, 2);
  assert.equal(s.out[0]!.height, -30);
  assert.equal(s.out[0]!.foam, 1);
  assert.equal(s.out[1]!.height, -SPLASH_MAX_DEPTH);
});

test("no splash on land, high in the air, or unseen", () => {
  const s = sink();
  emitSplash(world(0).terrain, 500, 500, 0, 100, ALL, s);
  emitSplash(world(60).terrain, 500, 500, 60 + 51, 100, ALL, s);
  emitSplash(world(60).terrain, 500, 500, 0, 100, NONE, s);
  assert.equal(s.out.length, 0);
});

function shell(): Projectile {
  return { id: 7, owner: 0, source: "artillery", x: 500 * PROJ_FP, y: 600 * PROJ_FP, z: 0, vx: 0, vy: 0, vz: 0, damage: 1, splash: 80, dig: 0, ttl: 3 } as Projectile;
}

test("a shell that vanishes over water splashes once", () => {
  const w = world(60);
  const sources = new RippleSources();
  const s = sink();
  const prev = new Map<number, PrevPose>();
  sources.collect(w, prev, 0, 0, ALL, s);
  w.tick = 1;
  w.projectiles.push(shell());
  sources.collect(w, prev, 0, 0, ALL, s);
  w.tick = 2;
  w.projectiles.length = 0;
  sources.collect(w, prev, 0, 0, ALL, s);
  sources.collect(w, prev, 0.5, 0, ALL, s);
  assert.equal(s.out.length, 1);
  assert.equal(s.out[0]!.x, 500);
  assert.equal(s.out[0]!.y, 600);
  assert.equal(s.out[0]!.radius, 80);
});

test("a death blast in water splashes once; blasts in the first world seen do not replay", () => {
  const w = world(60);
  w.blasts.push({ x: 100 * PROJ_FP, y: 100 * PROJ_FP, z: 0, damage: 1, radius: 120, owner: 0 });
  const sources = new RippleSources();
  const s = sink();
  sources.collect(w, new Map(), 0, 0, ALL, s);
  assert.equal(s.out.length, 0);
  w.tick = 1;
  sources.collect(w, new Map(), 0, 0, ALL, s);
  sources.collect(w, new Map(), 0, 0, ALL, s);
  assert.equal(s.out.length, 1);
  assert.equal(s.out[0]!.radius, 120);
});
