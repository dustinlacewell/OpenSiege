import assert from "node:assert/strict";
import { test } from "node:test";
import { hashWorld, spawnEdge } from "@mf/sim";
import { planErrors } from "../src/game/skirmish/planErrors.ts";
import { skirmishPlacement } from "../src/game/skirmish/placement.ts";
import type { SkirmishPlan } from "../src/game/skirmish/plan.ts";
import { autoSpot, BOT_CLEARANCE, clampSpot } from "../src/game/skirmish/spots.ts";
import { skirmishSeats, skirmishWorld } from "../src/game/skirmish/world.ts";
import { FFA_PLAN, mapFor, TEAM_PLAN } from "./support/skirmishFixtures.ts";

const SEED = 11;
const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);

test("every seat joins: players, names and teams follow the plan", () => {
  const { world, you } = skirmishWorld(mapFor(SEED), TEAM_PLAN, SEED, { x: 8000, y: 8000 });
  assert.equal(you, 1);
  assert.deepEqual(world.players.map((p) => [p.id, p.name, p.team]), [[1, "Ann", 0], [2, "Bot 1", 0], [3, "Bot 2", 1], [4, "Bot 3", 1]]);
  assert.equal(world.units.filter((u) => u.kind === "factory").length, 4);
});

test("a bot is made for each bot seat, with its player id", () => {
  const { bots } = skirmishWorld(mapFor(SEED), FFA_PLAN, SEED, null);
  assert.deepEqual(bots.map((b) => b.player), [2, 3]);
});

test("the human stands where it clicked, forced into the map", () => {
  const spec = mapFor(SEED);
  const { world, marks } = skirmishWorld(spec, FFA_PLAN, SEED, { x: 8000, y: 9000 });
  const mine = world.units.find((u) => u.owner === 1 && u.kind === "factory")!;
  assert.ok(dist(mine, { x: 8000, y: 9000 }) < 250, "the factory settles beside the spot");
  assert.deepEqual(marks.find((m) => m.me), { id: 1, x: 8000, y: 9000, name: "Ann", team: 0, me: true });
  const edge = spawnEdge(spec);
  const corner = skirmishWorld(spec, FFA_PLAN, SEED, { x: -50, y: 99999 });
  assert.deepEqual(corner.marks.find((m) => m.me), { id: 1, x: edge, y: spec.height - edge, name: "Ann", team: 0, me: true });
});

test("auto takes the spot from the seed", () => {
  const spec = mapFor(SEED);
  const auto = skirmishWorld(spec, FFA_PLAN, SEED, null);
  const want = autoSpot(spec, SEED, 0);
  const mine = auto.world.units.find((u) => u.owner === 1 && u.kind === "factory")!;
  assert.ok(dist(mine, want) < 250);
});

test("skirmishSeats marks the bots only, and the final world keeps a bot spot the human is not near", () => {
  const spec = mapFor(SEED);
  const seats = skirmishSeats(spec, FFA_PLAN, SEED);
  assert.deepEqual(seats.marks.map((m) => m.id), [2, 3]);
  assert.equal(seats.spots[0], null);
  const far = { x: spec.width - 1200, y: spec.height - 1200 };
  const kept = seats.marks.filter((m) => dist(m, far) >= BOT_CLEARANCE);
  const final = skirmishWorld(spec, FFA_PLAN, SEED, far);
  for (const m of kept) assert.ok(final.marks.some((f) => f.id === m.id && f.x === m.x && f.y === m.y));
});

test("a bot spot within BOT_CLEARANCE of the human's click is picked again", () => {
  const spec = mapFor(SEED);
  const seats = skirmishSeats(spec, FFA_PLAN, SEED);
  const bot = seats.marks[0]!;
  const final = skirmishWorld(spec, FFA_PLAN, SEED, { x: bot.x, y: bot.y });
  const moved = final.marks.find((m) => m.id === bot.id)!;
  assert.notDeepEqual([moved.x, moved.y], [bot.x, bot.y]);
  assert.ok(dist(moved, { x: bot.x, y: bot.y }) >= 600, "it no longer stacks on the human's spot");
});

test("every start spot is a minimum gap from the others", () => {
  const { marks } = skirmishWorld(mapFor(SEED), TEAM_PLAN, SEED, null);
  for (const a of marks) for (const b of marks) if (a.id < b.id) assert.ok(dist(a, b) >= 600, `${a.name} and ${b.name} stack`);
});

test("same seed, same world; another seed, another world", () => {
  const hash = (seed: number) => hashWorld(skirmishWorld(mapFor(seed), FFA_PLAN, seed, null).world);
  assert.equal(hash(5), hash(5));
  assert.notEqual(hash(5), hash(6));
});

test("same map and click, another seed: the bots' spots follow the seed", () => {
  const spec = mapFor(3);
  const spots = new Set([1, 2, 3, 4, 5, 6].map((seed) => JSON.stringify(skirmishSeats(spec, FFA_PLAN, seed).marks.map((m) => [m.x, m.y]))));
  assert.ok(spots.size > 1);
});

test("a plan that cannot be played throws", () => {
  const twoHumans: SkirmishPlan = { ...FFA_PLAN, seats: [{ kind: "human", team: 0 }, { kind: "human", team: 1 }] };
  assert.throws(() => skirmishSeats(mapFor(SEED), twoHumans, SEED), /exactly one human/);
  assert.throws(() => skirmishWorld(mapFor(SEED), { ...FFA_PLAN, teams: 2 }, SEED, null), /team number/);
});

test("planErrors: seat count, team caps, free-for-all numbers", () => {
  const bot = (team: number) => ({ kind: "bot" as const, name: "B", team, difficulty: "easy" as const });
  assert.deepEqual(planErrors(FFA_PLAN), []);
  assert.deepEqual(planErrors(TEAM_PLAN), []);
  assert.match(planErrors({ ...FFA_PLAN, seats: [{ kind: "human", team: 0 }, ...Array.from({ length: 8 }, (_, i) => bot(i + 1))] })[0]!, /at most 8 seats/);
  assert.equal(planErrors({ name: "A", teams: 3, seats: [{ kind: "human", team: 0 }, bot(0), bot(0)] }).length, 1);
  assert.equal(planErrors({ name: "A", teams: 0, seats: [{ kind: "human", team: 0 }, bot(0)] }).length, 1);
  assert.equal(planErrors({ name: "A", teams: 5, seats: [{ kind: "human", team: 0 }, bot(1)] }).length, 1);
});

test("clampSpot rounds, clamps to the spawn edge and sends a non-finite value to the centre", () => {
  const map = { width: 16000, height: 16000 };
  assert.deepEqual(clampSpot(map, 2000.4, 3000.6), { x: 2000, y: 3001 });
  assert.deepEqual(clampSpot(map, -5, 20000), { x: spawnEdge(map), y: 16000 - spawnEdge(map) });
  assert.deepEqual(clampSpot(map, NaN, Infinity), { x: 8000, y: 8000 });
});

test("the placement shows the bots' spots, lists everyone and answers a click with a clamped spot", () => {
  const spec = mapFor(SEED);
  const picked: unknown[] = [];
  let left = 0;
  const p = skirmishPlacement({ spec, plan: TEAM_PLAN, seed: SEED, onPick: (s) => picked.push(s), onLeave: () => left++ });
  assert.equal(p.you, 1);
  assert.equal(p.world.players.length, 0);
  const v = p.view(0);
  assert.equal(v.countdown, "");
  assert.deepEqual(v.marks.map((m) => m.id), [2, 3, 4]);
  assert.deepEqual(v.rows.map((r) => [r.name, r.team, r.picked, r.me]), [["Ann", 0, false, true], ["Bot 1", 0, true, false], ["Bot 2", 1, true, false], ["Bot 3", 1, true, false]]);
  p.onPick(-1, 9000);
  assert.deepEqual(picked, [{ x: spawnEdge(spec), y: 9000 }]);
  p.leave();
  assert.equal(left, 1);
});
