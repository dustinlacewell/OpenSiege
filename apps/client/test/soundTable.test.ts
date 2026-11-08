import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_TUNING } from "../src/audio/defaultTuning.ts";
import { CUES, TUNING_FIELDS, TUNING_SECTIONS, serializeSoundTuning } from "../src/audio/soundTuning.ts";
import { SOUND_SCHEMA } from "../src/dev/soundEditor/soundSchema.ts";
import { GLOBAL_COLUMN, tableToJson, tableToTuning, tuningToTable } from "../src/dev/soundEditor/soundTable.ts";
import { hasCell } from "../src/dev/tableEditor/model.ts";

// The sound tuning as the editor's table: the shape, and the way back.

const keysOf = (scope: "cue" | "global") => TUNING_FIELDS.filter((f) => f.scope === scope).map((f) => f.key);

test("the table has a column per cue in cue order, then the global column", () => {
  assert.deepEqual(Object.keys(tuningToTable(DEFAULT_TUNING)), [...CUES, GLOBAL_COLUMN]);
});

test("the table is ragged: cue fields in cue columns only, global fields in the global column only", () => {
  const table = tuningToTable(DEFAULT_TUNING);
  for (const cue of CUES) assert.deepEqual(Object.keys(table[cue]!), keysOf("cue"));
  assert.deepEqual(Object.keys(table[GLOBAL_COLUMN]!), keysOf("global"));
  assert.equal(hasCell(table, "ack", "voiceCap"), false);
  assert.equal(hasCell(table, GLOBAL_COLUMN, "rank"), false);
});

test("table to tuning and back is the identity", () => {
  const table = tuningToTable(DEFAULT_TUNING);
  const back = tableToTuning(table);
  assert.ok(back.ok);
  assert.deepEqual(back.tuning, DEFAULT_TUNING);
  assert.equal(serializeSoundTuning(back.tuning), serializeSoundTuning(DEFAULT_TUNING));
  assert.deepEqual(tuningToTable(back.tuning), table);
});

test("the saved JSON is the tuning file's shape", () => {
  const json = tableToJson(tuningToTable(DEFAULT_TUNING)) as { cues: object; global: object };
  assert.deepEqual(Object.keys(json), ["cues", "global"]);
  assert.deepEqual(Object.keys(json.cues), [...CUES]);
});

test("a table without the global column is refused by name", () => {
  const { [GLOBAL_COLUMN]: _gone, ...rest } = tuningToTable(DEFAULT_TUNING);
  const result = tableToTuning(rest);
  assert.ok(!result.ok);
  assert.ok(result.errors.some((e) => e.column === GLOBAL_COLUMN));
});

test("the schema has every tuning field and section, all as numbers", () => {
  assert.deepEqual(SOUND_SCHEMA.fields.map((f) => f.key), TUNING_FIELDS.map((f) => f.key));
  assert.deepEqual(SOUND_SCHEMA.sections, TUNING_SECTIONS);
  assert.ok(SOUND_SCHEMA.fields.every((f) => f.type === "number"));
});
