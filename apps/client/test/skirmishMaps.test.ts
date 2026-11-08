import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { buildLibrary } from "@mf/map";
import { validateMapSpec } from "@mf/sim";
import { libraryFiles, skirmishDraws } from "../src/game/skirmish/mapLibrary.ts";

const DIR = fileURLToPath(new URL("../../../maps/", import.meta.url));

/** The `maps/*.json` files the bundler's glob matches: the folder's own files, not its subfolders. */
function folder() {
  const names = readdirSync(DIR, { withFileTypes: true }).filter((e) => e.isFile()).map((e) => e.name);
  const texts = Object.fromEntries(names.filter((n) => n.endsWith(".json")).map((n) => [`../maps/${n}`, readFileSync(DIR + n, "utf8")]));
  const previews = Object.fromEntries(names.filter((n) => n.endsWith(".jpg")).map((n) => [`../maps/${n}`, `/assets/${n}`]));
  return { texts, previews };
}

test("libraryFiles pairs each map with its preview by stem", () => {
  const files = libraryFiles({ "../x/ford.json": "{}", "../x/lagoon.json": "{}" }, { "../x/ford.jpg": "/a/ford-1.jpg" });
  assert.deepEqual(files, [{ stem: "ford", text: "{}", previewUrl: "/a/ford-1.jpg" }, { stem: "lagoon", text: "{}", previewUrl: null }]);
});

test("the choices are every library map, then Random last", () => {
  const { texts, previews } = folder();
  const library = buildLibrary(libraryFiles(texts, previews), (line) => assert.fail(line));
  const draws = skirmishDraws(library);
  assert.equal(draws.length, library.length + 1);
  assert.ok(library.length >= 1);
  assert.deepEqual(draws.slice(0, -1).map((d) => d.info?.id), library.map((m) => m.stem));
  assert.equal(draws.at(-1)!.info, null);
});

test("the tutorial map is not among the choices", () => {
  const { texts, previews } = folder();
  const stems = skirmishDraws(buildLibrary(libraryFiles(texts, previews), () => {})).map((d) => d.info?.id);
  assert.ok(!stems.includes("tutorial"));
});

test("a library map ignores the seed; the Random one makes a valid map from it, a different one per seed", () => {
  const { texts, previews } = folder();
  const draws = skirmishDraws(buildLibrary(libraryFiles(texts, previews), () => {}));
  const first = draws[0]!;
  assert.equal(first.spec(1), first.spec(2));
  const random = draws.at(-1)!;
  assert.deepEqual(validateMapSpec(random.spec(4)), []);
  assert.notDeepEqual(random.spec(4).heights, random.spec(5).heights);
});
