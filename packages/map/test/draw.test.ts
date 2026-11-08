import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_MAP_PARAMS, generateMap } from "@mf/sim";
import { drawById, drawMap, emptyMap, mapChoices, mapLabel, type LibraryMap } from "../src/index.ts";

const params = DEFAULT_MAP_PARAMS;
const editorMap = (name: string) => emptyMap({ name, ...params, baseHeight: 0 });
const lib: LibraryMap[] = [
  { stem: "one", name: "One", spec: editorMap("One").spec, preview: "/maps/one.jpg" },
  { stem: "two", name: "Two", spec: editorMap("Two").spec, preview: null },
];

test("a library pick shows its name and preview, and its spec ignores the seed", () => {
  const draw = drawMap(lib, params, () => 0.2);
  assert.deepEqual(draw.info, { id: "one", name: "One", preview: "/maps/one.jpg" });
  assert.equal(draw.spec(1), lib[0]!.spec);
  assert.equal(draw.spec(999), lib[0]!.spec);
  assert.deepEqual(drawMap(lib, params, () => 0.5).info, { id: "two", name: "Two", preview: null });
});

test("the last slot is the generated map: info null, spec follows the seed", () => {
  const draw = drawMap(lib, params, () => 0.99);
  assert.equal(draw.info, null);
  assert.deepEqual(draw.spec(7), generateMap(7, params));
  assert.notDeepEqual(draw.spec(7), draw.spec(8));
});

test("an empty library always gives the generated map", () => {
  for (const r of [0, 0.5, 0.999]) assert.equal(drawMap([], params, () => r).info, null);
});

test("no generated slot: only library maps; nothing at all throws", () => {
  assert.equal(drawMap(lib, null, () => 0.99).info?.name, "Two");
  assert.throws(() => drawMap([], null, () => 0), /no maps/);
});

test("each slot is drawn with the same chance", () => {
  const counts = new Map<string, number>();
  for (let k = 0; k < 300; k++) {
    const name = drawMap(lib, params, () => (k + 0.5) / 300).info?.name ?? "random";
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  assert.deepEqual(Object.fromEntries(counts), { One: 100, Two: 100, random: 100 });
});

test("mapLabel quotes a library name and says random for a generated map", () => {
  assert.equal(mapLabel(drawMap(lib, params, () => 0)), '"One"');
  assert.equal(mapLabel(drawMap(lib, params, () => 0.99)), "random");
});

test("mapChoices lists every library map, and a random slot only with params", () => {
  assert.deepEqual(mapChoices(lib, params), {
    maps: [{ id: "one", name: "One", preview: "/maps/one.jpg" }, { id: "two", name: "Two", preview: null }],
    randomMap: true,
  });
  assert.equal(mapChoices(lib, null).randomMap, false);
});

test("drawById picks a library map by stem, the generated map for null, and null when the slot is missing", () => {
  assert.equal(drawById(lib, params, "two")?.info?.name, "Two");
  assert.equal(drawById(lib, params, null)?.info, null);
  assert.equal(drawById(lib, null, null), null);
  assert.equal(drawById(lib, params, "nope"), null);
});
