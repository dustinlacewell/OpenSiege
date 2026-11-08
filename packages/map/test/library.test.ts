import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_MAP_PARAMS } from "@mf/sim";
import { buildLibrary, emptyMap, mapStems, serializeMap } from "../src/index.ts";

const mapText = (name: string) => serializeMap(emptyMap({ name, ...DEFAULT_MAP_PARAMS, baseHeight: 0 }));

test("every good map loads with its name, spec and preview, sorted by stem", () => {
  const logs: string[] = [];
  const maps = buildLibrary([
    { stem: "b-map", text: mapText("Bee"), previewUrl: "/maps/b-map.jpg" },
    { stem: "a-map", text: mapText("Ay"), previewUrl: null },
  ], (l) => logs.push(l));
  assert.deepEqual(maps.map((m) => [m.stem, m.name, m.preview]), [["a-map", "Ay", null], ["b-map", "Bee", "/maps/b-map.jpg"]]);
  assert.equal(maps[0]!.spec.width, DEFAULT_MAP_PARAMS.width);
  assert.deepEqual(logs, []);
});

test("a bad file is skipped with a log line that lists its errors", () => {
  const logs: string[] = [];
  const maps = buildLibrary([
    { stem: "good", text: mapText("Good"), previewUrl: null },
    { stem: "bad", text: "not json", previewUrl: null },
  ], (l) => logs.push(l));
  assert.deepEqual(maps.map((m) => m.stem), ["good"]);
  assert.equal(logs.length, 1);
  assert.match(logs[0]!, /^map bad\.json skipped:\n- not valid JSON$/);
});

test("mapStems keeps the stems of *.json files with a valid map name, sorted", () => {
  assert.deepEqual(mapStems(["Upper.json", "a b.json", "notes.txt", "ok.json", "a-map.json", "pic.jpg"]), ["a-map", "ok"]);
});
