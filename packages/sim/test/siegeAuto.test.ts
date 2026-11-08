import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnUnit, step, UNIT_STATS } from "../src/index.ts";
import { freshState, TINY } from "./helpers.ts";

const KIND = "artillery";

test("a sieged unit takes a plain move: it packs, then drives off", () => {
  const s = freshState(1, TINY);
  const u = spawnUnit(s.world, 0, KIND, 1000, 1000);
  u.mode = "sieged";
  step(s, [{ player: 0, intent: { t: "move", units: [u.id], x: 1500, y: 1000, force: false, queue: false, attack: false } }]);
  assert.equal(u.mode, "packing");
  for (let t = 0; t < UNIT_STATS[KIND].siegeTicks + 5; t++) step(s, []);
  assert.equal(u.mode, "mobile");
  assert.ok(u.x > 1000);
});
