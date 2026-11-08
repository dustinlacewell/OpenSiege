import assert from "node:assert/strict";
import { test } from "node:test";
import { DEFAULT_SETTINGS } from "../src/settings/settingsModel.ts";
import { parseSettings, SettingsStore, type StorageSlot } from "../src/settings/settingsStore.ts";

const memory = (initial: string | null = null): StorageSlot & { saved: string | null } => {
  const slot = { saved: initial, get: () => slot.saved, set: (s: string) => void (slot.saved = s) };
  return slot;
};

const throwing: StorageSlot = {
  get: () => { throw new Error("blocked"); },
  set: () => { throw new Error("blocked"); },
};

test("parse: nothing stored gives the defaults", () => {
  assert.deepEqual(parseSettings(null), DEFAULT_SETTINGS);
  assert.deepEqual(parseSettings("junk"), DEFAULT_SETTINGS);
  assert.deepEqual(parseSettings({}), DEFAULT_SETTINGS);
});

test("parse: a valid stored value merges over the default", () => {
  assert.equal(parseSettings({ renderScale: 0.5 }).renderScale, 0.5);
});

test("parse: invalid and unknown values are dropped", () => {
  const v = parseSettings({ renderScale: 3, bogus: true });
  assert.equal(v.renderScale, DEFAULT_SETTINGS.renderScale);
  assert.equal("bogus" in v, false);
  assert.equal(parseSettings({ renderScale: "0.5" }).renderScale, DEFAULT_SETTINGS.renderScale);
});

test("store: loads saved values, and bad JSON falls back to the defaults", () => {
  assert.equal(new SettingsStore(memory('{"renderScale":0.75}')).get().renderScale, 0.75);
  assert.deepEqual(new SettingsStore(memory("{not json")).get(), DEFAULT_SETTINGS);
});

test("store: a storage that throws still works for the session", () => {
  const store = new SettingsStore(throwing);
  assert.deepEqual(store.get(), DEFAULT_SETTINGS);
  store.set({ renderScale: 0.5 });
  assert.equal(store.get().renderScale, 0.5);
});

test("store: set saves, ignores invalid values and notifies subscribers", () => {
  const slot = memory();
  const store = new SettingsStore(slot);
  const seen: number[] = [];
  const off = store.subscribe((v) => seen.push(v.renderScale));
  store.set({ renderScale: 0.5 });
  store.set({ renderScale: 9 });
  off();
  store.set({ renderScale: 0.75 });
  assert.deepEqual(seen, [0.5, 1]);
  assert.equal(JSON.parse(slot.saved!).renderScale, 0.75);
});
