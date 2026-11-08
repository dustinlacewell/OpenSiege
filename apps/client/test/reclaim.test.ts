import { test } from "node:test";
import assert from "node:assert/strict";
import type { Feature, FeatureKind, Unit, UnitKind, World } from "@mf/sim";
import { reclaim } from "../src/game/commands.ts";
import { scrapAt } from "../src/game/scrapPick.ts";

function feature(id: number, x: number, y: number, kind: FeatureKind = "scrap", hp = 100): Feature {
  return { id, kind, x, y, radius: 20, hp, variant: 0, unit: "tank" };
}

function world(...units: { id: number; owner: number; kind: UnitKind }[]): World {
  return { units: units as Unit[] } as unknown as World;
}

test("scrapAt finds the scrap whose circle plus tolerance holds the point", () => {
  const fs = [feature(1, 100, 100)];
  assert.equal(scrapAt(fs, 115, 100, 0)?.id, 1);
  assert.equal(scrapAt(fs, 125, 100, 0), undefined);
  assert.equal(scrapAt(fs, 125, 100, 8)?.id, 1);
});

test("scrapAt skips other kinds and spent scrap", () => {
  const fs = [feature(1, 100, 100, "rock"), feature(2, 100, 100, "wreckage"), feature(3, 100, 100, "scrap", 0)];
  assert.equal(scrapAt(fs, 100, 100, 5), undefined);
});

test("scrapAt picks the nearest centre, and the lower id on a tie", () => {
  assert.equal(scrapAt([feature(1, 100, 100), feature(2, 110, 100)], 108, 100, 0)?.id, 2);
  assert.equal(scrapAt([feature(4, 90, 100), feature(3, 110, 100)], 100, 100, 0)?.id, 3);
  assert.equal(scrapAt([feature(3, 90, 100), feature(4, 110, 100)], 100, 100, 0)?.id, 3);
});

test("reclaim orders only the selected own engineers", () => {
  const w = world(
    { id: 1, owner: 1, kind: "engineer" },
    { id: 2, owner: 1, kind: "tank" },
    { id: 3, owner: 2, kind: "engineer" },
    { id: 4, owner: 1, kind: "engineer" },
  );
  assert.deepEqual(reclaim(w, 1, [1, 2, 3, 4], 9, true), { t: "reclaim", units: [1, 4], target: 9, queue: true });
});

test("reclaim is null with no own engineer selected", () => {
  const w = world({ id: 1, owner: 1, kind: "tank" }, { id: 3, owner: 2, kind: "engineer" });
  assert.equal(reclaim(w, 1, [1, 3], 9, false), null);
  assert.equal(reclaim(w, 1, [], 9, false), null);
});
