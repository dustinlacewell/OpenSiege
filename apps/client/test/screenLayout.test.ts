import { test } from "node:test";
import assert from "node:assert/strict";
import { layoutOf } from "../src/ui/screenLayout.ts";

test("layout: one part per screen, HUD on match and ended", () => {
  assert.deepEqual(layoutOf(null), { pick: false, end: false, hud: false });
  assert.deepEqual(layoutOf("pick"), { pick: true, end: false, hud: false });
  assert.deepEqual(layoutOf("match"), { pick: false, end: false, hud: true });
  assert.deepEqual(layoutOf("ended"), { pick: false, end: true, hud: true });
});
