import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_MAP_PARAMS, createWorld, generateMap, goodSpawnSpot, inWater, spawnEdge, type MapSpec } from "@mf/sim";
import { botStartSpot } from "../src/start/botStartSpot.ts";
import { MIN_GAP_FLOOR, minGap, pickStartSpot, REACH, type Spot, type TakenSpot } from "../src/start/pickStartSpot.ts";

const SIDE = 16000, CELL = 500, COLS = SIDE / CELL + 1;

/** Flat dry ground: one low corner vertex sets the sea below the rest. No features. */
function flatSpec(fields: MapSpec["fields"]): MapSpec {
  const heights = new Array<number>(COLS * COLS).fill(200);
  heights[0] = 0;
  return { width: SIDE, height: SIDE, cell: CELL, heights, rng: 1, fields, features: [] };
}

/** Three fields close together around (x, y). */
function cluster(x: number, y: number, amount: number): MapSpec["fields"] {
  return [{ x, y, radius: 500, amount }, { x: x + 1500, y, radius: 500, amount }, { x, y: y + 1500, radius: 500, amount }];
}

const dist = (a: Spot, b: Spot) => Math.hypot(a.x - b.x, a.y - b.y);
const knobs = { wealthWeight: 0.6, topN: 1 };

test("start spot: on generated maps the pick is inside the spawn clamp", () => {
  for (let seed = 1; seed <= 5; seed++) {
    const spec = generateMap(seed, DEFAULT_MAP_PARAMS);
    const edge = spawnEdge(spec);
    for (const d of ["easy", "normal", "hard"] as const) {
      const s = botStartSpot(spec, [], { team: 1 }, d, seed);
      assert.ok(s.x >= edge && s.x <= spec.width - edge && s.y >= edge && s.y <= spec.height - edge, `seed ${seed} ${d}`);
    }
  }
});

test("start spot: one rich cluster draws the pick within REACH of it", () => {
  const spec = flatSpec([...cluster(4000, 4000, 5000), { x: 12000, y: 3000, radius: 500, amount: 500 }, { x: 3000, y: 12000, radius: 500, amount: 500 }]);
  const s = pickStartSpot(spec, [], { team: 1 }, knobs, 1);
  assert.ok(dist(s, { x: 4500, y: 4500 }) < REACH, JSON.stringify(s));
});

test("start spot: an enemy beside one cluster sends the pick to an equal cluster far away; a teammate does not", () => {
  const spec = flatSpec([...cluster(4000, 4000, 5000), ...cluster(11000, 11000, 5000)]);
  const enemy = pickStartSpot(spec, [{ x: 4200, y: 4000, team: 2 }], { team: 1 }, knobs, 1);
  assert.ok(dist(enemy, { x: 11500, y: 11500 }) < REACH, JSON.stringify(enemy));
  // The teammate stands beyond the minimum gap from every candidate, so only its team decides.
  const ally = pickStartSpot(spec, [{ x: 4000, y: 12000, team: 1 }], { team: 1 }, { wealthWeight: 0, topN: 1 }, 1);
  assert.deepEqual(ally, pickStartSpot(spec, [], { team: 1 }, { wealthWeight: 0, topN: 1 }, 1));
});

/** Each bot in turn picks against the spots before it. */
function seatBots(spec: MapSpec, teams: readonly number[]): Spot[] {
  const taken: TakenSpot[] = [];
  teams.forEach((team, i) => taken.push({ ...botStartSpot(spec, taken, { team }, "normal", i + 1), team }));
  return taken;
}

function closestPair(spots: readonly Spot[]): number {
  let min = Infinity;
  spots.forEach((a, i) => spots.slice(i + 1).forEach((b) => (min = Math.min(min, dist(a, b)))));
  return min;
}

test("start spot: four bots in a free-for-all never stack, and mostly keep the full minimum gap", () => {
  let full = 0;
  for (let seed = 1; seed <= 20; seed++) {
    const spec = generateMap(seed, DEFAULT_MAP_PARAMS);
    const gap = closestPair(seatBots(spec, [1, 2, 3, 4]));
    assert.ok(gap >= MIN_GAP_FLOOR, `seed ${seed}: ${gap}`);
    if (gap >= minGap(spec)) full++;
  }
  assert.ok(full > 10, `${full} of 20 seeds keep the full gap`);
});

test("start spot: in a 2v2 allies never share a point", () => {
  for (let seed = 1; seed <= 20; seed++) {
    const [a, , b] = seatBots(generateMap(seed, DEFAULT_MAP_PARAMS), [1, 2, 1, 2]);
    assert.ok(dist(a!, b!) >= MIN_GAP_FLOOR, `seed ${seed}`);
  }
});

test("start spot: the same seed gives the same spot", () => {
  const spec = generateMap(3, DEFAULT_MAP_PARAMS);
  const loose = { wealthWeight: 0.5, topN: 6 };
  assert.deepEqual(pickStartSpot(spec, [], { team: 1 }, loose, 42), pickStartSpot(spec, [], { team: 1 }, loose, 42));
});

test("start spot: no usable candidate falls back to a usable grid point, a different one for the next bot", () => {
  // The only field sits in the corner, so its centre and ring all fall outside the spawn clamp.
  const spec = flatSpec([{ x: 200, y: 200, radius: 100, amount: 1000 }]);
  const world = createWorld(spec), edge = spawnEdge(spec);
  const first = pickStartSpot(spec, [], { team: 1 }, knobs, 1);
  const second = pickStartSpot(spec, [{ ...first, team: 1 }], { team: 2 }, knobs, 2);
  for (const s of [first, second]) {
    assert.ok(s.x >= edge && s.x <= SIDE - edge && s.y >= edge && s.y <= SIDE - edge, JSON.stringify(s));
    assert.ok(!inWater(world.terrain, s.x, s.y) && goodSpawnSpot(world, s.x, s.y), JSON.stringify(s));
  }
  assert.notDeepEqual(first, second);
});

test("start spot: an all-water map falls back to the map centre", () => {
  const water: MapSpec = { ...flatSpec([{ x: 8000, y: 8000, radius: 500, amount: 1000 }]), heights: new Array<number>(COLS * COLS).fill(200) };
  assert.deepEqual(pickStartSpot(water, [], { team: 1 }, knobs, 1), { x: SIDE / 2, y: SIDE / 2 });
});
