import { test } from "node:test";
import assert from "node:assert/strict";
import { holdSpot } from "../src/terrain/hold.ts";
import { studyMap } from "../src/terrain/study.ts";
import { GAP, ridge, RIDGE_X, terrainOf, wallWithGap, worldOf } from "./terrainWorld.ts";

test("hold spot: a ridge crest facing the front beats the flat ground round it", () => {
  const site = { x: 500, y: 2500 }, front = { x: 4500, y: 2500 };
  const s = studyMap(worldOf(terrainOf((x) => ridge(x)), [site, front]));
  const spot = holdSpot(s, site, front);
  assert.ok(spot, "a spot");
  assert.ok(Math.abs(spot.x - RIDGE_X) <= 250, `spot ${JSON.stringify(spot)}`);
});

test("hold spot: on flat ground with no ridge it still picks a cell on the road", () => {
  const site = { x: 500, y: 2500 }, front = { x: 4500, y: 2500 };
  const s = studyMap(worldOf(terrainOf(() => 0), [site, front]));
  const spot = holdSpot(s, site, front);
  assert.ok(spot && Math.abs(spot.y - 2500) <= 250 && spot.x > site.x, `spot ${JSON.stringify(spot)}`);
});

test("hold spot: behind a wall with one gap, the line holds at the gap on our side", () => {
  const site = { x: 500, y: 1000 }, front = { x: 4500, y: 1000 };
  const s = studyMap(worldOf(terrainOf(wallWithGap), [site, front, { x: 500, y: 4000 }, { x: 4500, y: 4000 }]));
  const spot = holdSpot(s, site, front);
  assert.ok(spot, "a spot");
  assert.ok(spot.x < GAP.x && Math.hypot(spot.x - GAP.x, spot.y - GAP.y) <= 600, `spot ${JSON.stringify(spot)}`);
});

test("hold spot: no spot when the road is too short", () => {
  const s = studyMap(worldOf(terrainOf(() => 0), []));
  assert.equal(holdSpot(s, { x: 500, y: 500 }, { x: 900, y: 500 }), undefined);
});
