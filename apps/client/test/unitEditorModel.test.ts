import { test } from "node:test";
import assert from "node:assert/strict";
import { STAT_KEYS, STAT_SECTIONS, UNIT_STATS } from "@mf/sim";
import { createEditor, errorsOf, setValue, type EditorState } from "../src/dev/tableEditor/model.ts";
import { barFractions, matchesFilter } from "../src/dev/tableEditor/rows.ts";
import type { Table } from "../src/dev/tableEditor/schema.ts";
import { UNIT_RULES, isRelevant } from "../src/dev/unitEditor/unitRules.ts";
import { UNIT_SCHEMA } from "../src/dev/unitEditor/unitSchema.ts";

// What the unit editor adds to the table editor: the sim's schema and rules. The editing itself is in tableEditorModel.test.ts.

const table = (): Table => structuredClone(UNIT_STATS);
const fresh = (): EditorState => createEditor({ schema: UNIT_SCHEMA, rules: UNIT_RULES }, table());

test("the unit schema has every sim stat in order, whole numbers as number fields with no decimals and step 1", () => {
  assert.deepEqual(UNIT_SCHEMA.fields.map((f) => f.key), [...STAT_KEYS]);
  assert.deepEqual(UNIT_SCHEMA.sections.map((s) => s.id), STAT_SECTIONS.map((s) => s.id));
  const cost = UNIT_SCHEMA.fields.find((f) => f.key === "cost");
  assert.deepEqual(cost && { type: cost.type, decimals: "decimals" in cost && cost.decimals, step: "step" in cost && cost.step }, { type: "number", decimals: 0, step: 1 });
  assert.equal(UNIT_SCHEMA.fields.find((f) => f.key === "weapon")?.type, "enum");
  assert.equal(UNIT_SCHEMA.fields.find((f) => f.key === "buildable")?.type, "bool");
});

test("a unit's number out of its range is invalid, with the sim's message", () => {
  const s = setValue(fresh(), "tank", "radius", 100000);
  assert.match(errorsOf(s)["tank.radius"]!, /1 to 500/);
  assert.equal(errorsOf(setValue(fresh(), "tank", "maxHp", 0))["tank.maxHp"], "must be 1 to 100000");
  assert.deepEqual(errorsOf(fresh()), {});
});

test("a non-integer unit stat is invalid", () => {
  assert.equal(errorsOf(setValue(fresh(), "tank", "cost", 1.5))["tank.cost"], "must be a whole number");
});

test("cross-field rule: an armed unit needs a shell speed", () => {
  const s = setValue(fresh(), "tank", "shotSpeed", 0);
  assert.match(errorsOf(s)["tank.shotSpeed"]!, /shell speed/);
  const armed = setValue(setValue(fresh(), "harvester", "weapon", "direct"), "harvester", "shotSpeed", 0);
  assert.match(errorsOf(armed)["harvester.shotSpeed"]!, /shell speed/);
  assert.deepEqual(errorsOf(setValue(fresh(), "harvester", "weapon", "none")), {});
});

test("relevance: weapon fields follow the weapon", () => {
  const { tank, factory } = table();
  for (const key of ["damage", "range", "reload", "shotSpeed", "splash"] as const) {
    assert.equal(isRelevant(tank, key), true, key);
    assert.equal(isRelevant(factory, key), false, key);
  }
  assert.equal(isRelevant(factory, "weapon"), true);
});

test("relevance: siege weapon fields need a weapon and a siege mode", () => {
  const { tank } = table();
  assert.equal(isRelevant(tank, "siegeDamage"), true);
  assert.equal(isRelevant({ ...tank, siegeTicks: 0 }, "siegeDamage"), false);
  assert.equal(isRelevant({ ...tank, weapon: "none" }, "siegeRange"), false);
  assert.equal(isRelevant({ ...tank, siegeTicks: 0 }, "siegeArmor"), false);
});

test("relevance: work range is never dimmed", () => {
  const { tank, factory } = table();
  assert.equal(isRelevant(tank, "workRange"), true);
  assert.equal(isRelevant({ ...factory, siegeTicks: 0, weapon: "none" }, "workRange"), true);
  assert.equal(isRelevant(tank, "cost"), true);
});

test("filter matches a stat's label, key and help, every word", () => {
  const match = (key: string, text: string): boolean => matchesFilter(UNIT_SCHEMA, key, text);
  assert.equal(match("maxHp", "max hp"), true);
  assert.equal(match("maxHp", "maxhp"), true);
  assert.equal(match("siegeTicks", "deploy"), true);
  assert.equal(match("siegeTicks", "deploy zzz"), false);
  assert.equal(match("cost", "  "), true);
  assert.equal(match("cost", "RELOAD"), false);
});

test("bars scale to the row's largest value", () => {
  const t = table();
  const f = barFractions(UNIT_SCHEMA, t, "cost");
  assert.equal(Math.max(...Object.values(f)), 1);
  assert.equal(f.factory, 1);
  assert.equal(f.tank, t.tank!.cost / t.factory!.cost);
  const none = barFractions(UNIT_SCHEMA, t, "weapon");
  assert.ok(Object.values(none).every((v) => v === 0));
  const zero = structuredClone(UNIT_STATS);
  for (const k of Object.keys(zero) as (keyof typeof zero)[]) zero[k].splash = 0;
  assert.ok(Object.values(barFractions(UNIT_SCHEMA, zero, "splash")).every((v) => v === 0));
});
