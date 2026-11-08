import { test } from "node:test";
import assert from "node:assert/strict";
import { mapTile } from "../src/ui/mapTile.ts";

test("map tile: preview, name only, or random", () => {
  assert.deepEqual(mapTile({ name: "First", preview: "/maps/first-map.jpg" }), { kind: "preview", name: "First", url: "/maps/first-map.jpg" });
  assert.deepEqual(mapTile({ name: "First", preview: null }), { kind: "named", name: "First" });
  assert.deepEqual(mapTile(null), { kind: "random" });
});
