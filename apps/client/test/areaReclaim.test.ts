import { test } from "node:test";
import assert from "node:assert/strict";
import { MAX_ORDERS, type Feature, type FeatureKind, type Unit, type UnitKind, type World } from "@mf/sim";
import { chainFrom, scrapsInCircle } from "../src/game/areaReclaim.ts";
import { areaReclaim } from "../src/game/commands.ts";

function feature(id: number, x: number, y: number, kind: FeatureKind = "scrap", hp = 100): Feature {
  return { id, kind, x, y, radius: 20, hp, variant: 0, unit: "tank" };
}

function world(features: Feature[], ...units: { id: number; owner: number; kind: UnitKind; x: number; y: number }[]): World {
  return { units: units as Unit[], features } as unknown as World;
}

const ids = (fs: readonly { id: number }[]) => fs.map((f) => f.id);

test("scrapsInCircle keeps live scrap whose centre is in the circle", () => {
  const fs = [feature(1, 100, 100), feature(2, 150, 100), feature(3, 151, 100), feature(4, 110, 100, "rock"), feature(5, 120, 100, "scrap", 0)];
  assert.deepEqual(ids(scrapsInCircle(fs, 100, 100, 50)), [1, 2]);
});

test("chainFrom walks to the nearest wreck left each step", () => {
  const fs = [feature(1, 300, 0), feature(2, 100, 0), feature(3, 0, 50), feature(4, 200, 0)];
  assert.deepEqual(ids(chainFrom(fs, 0, 0, 10)), [3, 2, 4, 1]);
});

test("chainFrom breaks a tie with the lower id, and stops at max", () => {
  assert.deepEqual(ids(chainFrom([feature(5, 10, 0), feature(4, -10, 0)], 0, 0, 10)), [4, 5]);
  assert.deepEqual(ids(chainFrom([feature(1, 10, 0), feature(2, 20, 0), feature(3, 30, 0)], 0, 0, 2)), [1, 2]);
});

test("areaReclaim chains from the first selected own engineer; only the first intent takes the queue flag", () => {
  const w = world(
    [feature(1, 100, 0), feature(2, 0, 0), feature(3, 500, 0)],
    { id: 7, owner: 1, kind: "tank", x: 200, y: 0 },
    { id: 8, owner: 1, kind: "engineer", x: 120, y: 0 },
    { id: 9, owner: 1, kind: "engineer", x: -50, y: 0 },
  );
  const out = areaReclaim(w, 1, [7, 8, 9], 50, 0, 100, false);
  assert.deepEqual(out, [
    { t: "reclaim", units: [8, 9], target: 1, queue: false },
    { t: "reclaim", units: [8, 9], target: 2, queue: true },
  ]);
});

test("areaReclaim caps the chain at MAX_ORDERS", () => {
  const fs = Array.from({ length: MAX_ORDERS + 5 }, (_, i) => feature(i + 1, i, 0));
  const w = world(fs, { id: 8, owner: 1, kind: "engineer", x: 0, y: 0 });
  assert.equal(areaReclaim(w, 1, [8], 0, 0, 1000, true).length, MAX_ORDERS);
});

test("areaReclaim is empty with no own engineer selected", () => {
  const w = world([feature(1, 0, 0)], { id: 7, owner: 1, kind: "tank", x: 0, y: 0 }, { id: 8, owner: 2, kind: "engineer", x: 0, y: 0 });
  assert.deepEqual(areaReclaim(w, 1, [7, 8], 0, 0, 100, false), []);
});
