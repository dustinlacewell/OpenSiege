import assert from "node:assert/strict";
import { test } from "node:test";
import { allFields, DEFAULT_SETTINGS, isValidFor, SETTINGS_TABS } from "../src/settings/settingsModel.ts";
import { escapeAction } from "../src/ui/pauseModel.ts";

test("every field has a default of the right kind", () => {
  for (const f of allFields()) {
    assert.equal(isValidFor(f, DEFAULT_SETTINGS[f.id]), true, f.id);
  }
});

test("choice defaults are among the options", () => {
  for (const f of allFields()) {
    if (f.kind === "choice") assert.ok(f.options.some((o) => o.value === DEFAULT_SETTINGS[f.id]), f.id);
  }
});

test("field ids are unique, and tab ids are unique", () => {
  const ids = allFields().map((f) => f.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(new Set(SETTINGS_TABS.map((t) => t.id)).size, SETTINGS_TABS.length);
});

test("escape: settings close first, then the pause menu, then a match pauses", () => {
  assert.equal(escapeAction({ settingsOpen: true, pauseOpen: true, inMatch: true }), "closeSettings");
  assert.equal(escapeAction({ settingsOpen: false, pauseOpen: true, inMatch: true }), "resume");
  assert.equal(escapeAction({ settingsOpen: false, pauseOpen: false, inMatch: true }), "pause");
});

test("escape: outside a match nothing opens", () => {
  assert.equal(escapeAction({ settingsOpen: false, pauseOpen: false, inMatch: false }), "none");
});
