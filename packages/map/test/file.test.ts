import { test } from "node:test";
import assert from "node:assert/strict";
import { validateMapSpec } from "@mf/sim";
import { emptyMap, parseMap, parseMapSpec, serializeMap } from "../src/file.ts";

const props = (width: number, height: number, cell: number, baseHeight: number) => ({ name: "test", width, height, cell, baseHeight });
const small = () => emptyMap(props(2000, 2000, 125, 5));
const errorsOf = (r: object): string[] => ("errors" in r ? (r.errors as string[]) : []);
const tamper = (edit: (o: any) => void): string => {
  const o = JSON.parse(serializeMap(small()));
  edit(o);
  return JSON.stringify(o);
};

test("round-trips a map", () => {
  const m = small();
  m.spec.fields.push({ x: 1000, y: 1000, radius: 200, amount: 50 });
  m.materials.weights[7] = 99;
  const r = parseMap(serializeMap(m));
  assert.ok("map" in r);
  assert.deepEqual(r.map.spec, m.spec);
  assert.deepEqual(r.map.palette, m.palette);
  assert.deepEqual(Array.from(r.map.materials.weights), Array.from(m.materials.weights));
});

test("serialize is stable and compact", () => {
  const s = serializeMap(small());
  assert.equal(s, serializeMap(small()));
  assert.ok(!s.includes("\n"));
  assert.deepEqual(Object.keys(JSON.parse(s)), ["version", "name", "baseHeight", "spec", "materials", "palette"]);
});

test("rejects bad JSON and bad version", () => {
  assert.ok(errorsOf(parseMap("{nope")).length > 0);
  assert.ok(errorsOf(parseMap(tamper((o) => (o.version = 2)))).length > 0);
});

test("rejects an invalid spec", () => {
  const bad = tamper((o) => (o.spec.cell = 300));
  assert.ok(errorsOf(parseMap(bad)).length > 0);
  assert.ok(errorsOf(parseMapSpec(bad)).length > 0);
  assert.ok(errorsOf(parseMapSpec(tamper((o) => o.spec.heights.pop()))).length > 0);
});

test("rejects wrong-size or non-base64 materials", () => {
  assert.ok(errorsOf(parseMap(tamper((o) => (o.materials = btoa("abc"))))).length > 0);
  assert.ok(errorsOf(parseMap(tamper((o) => (o.materials = "!!!")))).length > 0);
  assert.ok(errorsOf(parseMap(tamper((o) => delete o.materials))).length > 0);
});

test("rejects a bad palette", () => {
  assert.ok(errorsOf(parseMap(tamper((o) => o.palette.pop()))).length > 0);
  assert.ok(errorsOf(parseMap(tamper((o) => (o.palette[0].color[1] = 256)))).length > 0);
  assert.ok(errorsOf(parseMap(tamper((o) => (o.palette[0].color = [1, 2])))).length > 0);
  assert.ok(errorsOf(parseMap(tamper((o) => (o.palette[2].name = 5)))).length > 0);
});

test("parseMapSpec ignores materials and palette", () => {
  const r = parseMapSpec(tamper((o) => { delete o.materials; delete o.palette; }));
  assert.ok("spec" in r);
});

test("emptyMap validates clean and rejects bad dimensions", () => {
  assert.deepEqual(validateMapSpec(small().spec), []);
  assert.equal(small().materials.weights[0], 255);
  assert.throws(() => emptyMap(props(1000, 1000, 125, 0)));
  assert.throws(() => emptyMap(props(2000, 2000, 300, 0)));
});

test("a 16000x16000 cell-125 map round-trips", () => {
  const m = emptyMap(props(16000, 16000, 125, 3));
  m.materials.weights[12345] = 7;
  const r = parseMap(serializeMap(m));
  assert.ok("map" in r);
  assert.equal(r.map.materials.weights.length, 129 * 129 * 4);
  assert.deepEqual(Array.from(r.map.materials.weights), Array.from(m.materials.weights));
  assert.deepEqual(r.map.spec, m.spec);
});
