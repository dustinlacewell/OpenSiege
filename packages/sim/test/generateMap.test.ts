import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  DEFAULT_MAP_PARAMS, MAX_FIELDS, MIN_MAP_SIDE, TERRAIN_MAX_HEIGHT, generateMap, validateMapParams, validateMapSpec,
  type MapParams, type MapSpec,
} from "../src/index.ts";
import { TALL, TINY, WIDE, cachedSpec } from "./helpers.ts";

interface Print { heights: string; fields: string; features: string; counts: [number, number]; rng: number }
const OLD = JSON.parse(readFileSync(fileURLToPath(new URL("./fixtures/oldGenerator.json", import.meta.url)), "utf8")) as Record<string, Print>;

const md5 = (v: unknown) => createHash("md5").update(JSON.stringify(v)).digest("hex");

interface FeaturePrint { features: string; counts: [number, number]; rng: number }
const NEW = JSON.parse(readFileSync(fileURLToPath(new URL("./fixtures/defaultMap.json", import.meta.url)), "utf8")) as Record<string, FeaturePrint>;

/**
 * Heights, fields and the final rng are compared with the old generator for every seed: the
 * generator runs as before. The spec drops the few trees the old generator placed outside the map,
 * so the feature list and counts of those seeds use the fingerprints in fixtures/defaultMap.json.
 */
for (const [seed, old] of Object.entries(OLD)) {
  test(`default map for seed ${seed} matches the old generator`, () => {
    const s = generateMap(Number(seed), DEFAULT_MAP_PARAMS);
    assert.equal(md5(s.heights), old.heights);
    assert.equal(md5(s.fields.map((f) => [f.x, f.y, f.radius, f.amount])), old.fields);
    const want = NEW[seed] ?? old;
    assert.equal(md5(s.features.map((f) => [f.kind, f.x, f.y, f.radius, f.variant])), want.features);
    assert.deepEqual([s.fields.length, s.features.length], want.counts);
    assert.equal(s.rng, old.rng);
    assert.equal(s.rng, want.rng);
  });
}

test("same seed and params give equal specs", () => {
  assert.deepEqual(generateMap(7, TINY), generateMap(7, TINY));
});

test("different seeds give different specs", () => {
  assert.notDeepEqual(generateMap(7, TINY).heights, generateMap(8, TINY).heights);
});

for (const [name, p] of [["wide", WIDE], ["tall", TALL], ["tiny", TINY]] as const) {
  test(`${name} map is valid and in range`, () => {
    const s = cachedSpec(1, p);
    assert.deepEqual(validateMapSpec(s), []);
    assert.equal(s.heights.length, (p.width / p.cell + 1) * (p.height / p.cell + 1));
    assert.ok(s.heights.every((h) => Number.isInteger(h) && h >= 0 && h <= TERRAIN_MAX_HEIGHT));
    assert.ok(s.fields.length <= MAX_FIELDS);
    for (const f of s.fields) {
      assert.ok(f.x - f.radius > 0 && f.x + f.radius < p.width, "field x inside");
      assert.ok(f.y - f.radius > 0 && f.y + f.radius < p.height, "field y inside");
    }
  });
}

test("wide map counts scale with area (0.75 of default)", () => {
  const base = cachedSpec(1, DEFAULT_MAP_PARAMS);
  const wide = cachedSpec(1, WIDE);
  assert.ok(wide.fields.length >= 0.5 * base.fields.length && wide.fields.length <= 0.95 * base.fields.length, `fields ${wide.fields.length}`);
  assert.ok(wide.features.length >= 0.55 * base.features.length && wide.features.length <= 0.95 * base.features.length, `features ${wide.features.length}`);
});

test("tiny map has fewer features than the default", () => {
  assert.ok(cachedSpec(1, TINY).features.length < cachedSpec(1, DEFAULT_MAP_PARAMS).features.length / 10);
});

const BAD_PARAMS: [string, MapParams][] = [
  ["cell not dividing width", { width: 16050, height: 16000, cell: 125 }],
  ["cell not dividing height", { width: 16000, height: 16050, cell: 125 }],
  ["cell not dividing 1000", { width: 15000, height: 15000, cell: 150 }],
  ["side under minimum", { width: 16000, height: MIN_MAP_SIDE - 125 * 2, cell: 125 }],
  ["too many cells", { width: 400000, height: 400000, cell: 25 }],
  ["a side with too many cells", { width: 100000, height: 2000, cell: 25 }],
  ["non-integer width", { width: 16000.5, height: 16000, cell: 125 }],
  ["non-integer cell", { width: 16000, height: 16000, cell: 62.5 }],
  ["zero cell", { width: 16000, height: 16000, cell: 0 }],
  ["NaN height", { width: 16000, height: NaN, cell: 125 }],
];

for (const [name, p] of BAD_PARAMS) {
  test(`params rejected: ${name}`, () => {
    assert.ok(validateMapParams(p).length > 0);
    assert.throws(() => generateMap(1, p), /generateMap/);
  });
}

test("params at the minimum side are accepted", () => {
  assert.deepEqual(validateMapParams({ width: MIN_MAP_SIDE, height: MIN_MAP_SIDE, cell: 125 }), []);
});

function edited(edit: (s: MapSpec) => void): string[] {
  const s = structuredClone(cachedSpec(1, TINY));
  edit(s);
  return validateMapSpec(s);
}

test("spec rejected: wrong heights length", () => {
  assert.ok(edited((s) => s.heights.pop()).length > 0);
});

test("spec rejected: height above the ceiling", () => {
  assert.ok(edited((s) => { s.heights[5] = TERRAIN_MAX_HEIGHT + 1; }).length > 0);
});

test("spec rejected: negative or fractional height", () => {
  assert.ok(edited((s) => { s.heights[5] = -1; }).length > 0);
  assert.ok(edited((s) => { s.heights[5] = 1.5; }).length > 0);
});

test("spec rejected: field outside the map", () => {
  assert.ok(edited((s) => s.fields.push({ x: s.width - 10, y: 1000, radius: 100, amount: 5000 })).length > 0);
});

test("spec rejected: too many fields", () => {
  const errors = edited((s) => {
    for (let i = 0; i < MAX_FIELDS + 1; i++) s.fields.push({ x: 1000, y: 1000, radius: 100, amount: 5000 });
  });
  assert.ok(errors.some((e) => e.includes("fields")));
});

test("spec: feature centre on the map edge is accepted, 1 unit outside is rejected", () => {
  const spec = cachedSpec(1, WIDE);
  const w = spec.width, h = spec.height;
  const at = (x: number, y: number) => {
    const s = structuredClone(spec);
    s.features.push({ kind: "tree", x, y, radius: 50, variant: 0 });
    return validateMapSpec(s);
  };
  for (const [x, y] of [[0, 1000], [w, 1000], [1000, 0], [1000, h]]) assert.deepEqual(at(x, y), [], `edge ${x},${y}`);
  for (const [x, y] of [[-1, 1000], [w + 1, 1000], [1000, -1], [1000, h + 1]]) assert.ok(at(x, y).length > 0, `outside ${x},${y}`);
});

const SEEDS_1_12 = Array.from({ length: 12 }, (_, i) => i + 1);
for (const [name, p, seeds] of [
  ["24000x8000", WIDE, [...SEEDS_1_12, 4242]],
  ["4000x12000", TALL, [...SEEDS_1_12, 4242]],
  ["default", DEFAULT_MAP_PARAMS, [1, 2, 42, 4242]],
] as const) {
  test(`every feature centre is on the ${name} map`, () => {
    for (const seed of seeds) {
      const s = generateMap(seed, p);
      for (const f of s.features) {
        assert.ok(f.x >= 0 && f.x <= p.width && f.y >= 0 && f.y <= p.height, `seed ${seed}: ${f.kind} at ${f.x},${f.y}`);
      }
    }
  });
}
