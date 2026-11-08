import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_TUNING } from "../src/audio/defaultTuning.ts";
import { columnCrossErrors } from "../src/audio/soundTuning.ts";
import { soundLabel, soundRules } from "../src/dev/soundEditor/soundRules.ts";
import { SOUND_SCHEMA } from "../src/dev/soundEditor/soundSchema.ts";
import { GLOBAL_COLUMN, tuningToTable } from "../src/dev/soundEditor/soundTable.ts";
import { createEditor, errorsOf, setValue, type EditorState } from "../src/dev/tableEditor/model.ts";

// What the sound editor adds: the audio core's field and cross rules on the table. The editing is in tableEditorModel.test.ts.

/** An editor whose rules read the voice cap from its own draft, as the page does. */
function fresh(): { get(): EditorState; set(column: string, field: string, value: number): void } {
  let s!: EditorState;
  const rules = soundRules(() => s.draft[GLOBAL_COLUMN]!.voiceCap as number);
  s = createEditor({ schema: SOUND_SCHEMA, rules }, tuningToTable(DEFAULT_TUNING));
  return { get: () => s, set: (column, field, value) => void (s = setValue(s, column, field, value)) };
}

test("the shipped tuning has no errors", () => {
  assert.deepEqual(errorsOf(fresh().get()), {});
});

test("a number out of its range is invalid", () => {
  const e = fresh();
  e.set("shotDirect", "baseGain", 3);
  assert.equal(errorsOf(e.get())["shotDirect.baseGain"], "must be 0 to 2");
});

test("reserved slots must stay below the voice cap", () => {
  const e = fresh();
  e.set(GLOBAL_COLUMN, "reservedSlots", DEFAULT_TUNING.global.voiceCap);
  assert.match(errorsOf(e.get())["global.reservedSlots"]!, /Reserved slots/);
});

test("zoom near must stay below zoom far", () => {
  const e = fresh();
  e.set(GLOBAL_COLUMN, "zoomNear", DEFAULT_TUNING.global.zoomFar);
  assert.match(errorsOf(e.get())["global.zoomNear"]!, /Zoom near/);
});

test("a cue's at-once limit must not pass the voice cap, and the error follows the cap", () => {
  const e = fresh();
  e.set("shotDirect", "atOnceLimit", 20);
  assert.equal(errorsOf(e.get())["shotDirect.atOnceLimit"], undefined);
  e.set(GLOBAL_COLUMN, "voiceCap", 16);
  assert.match(errorsOf(e.get())["shotDirect.atOnceLimit"]!, /voice cap/);
  e.set(GLOBAL_COLUMN, "voiceCap", 24);
  assert.equal(errorsOf(e.get())["shotDirect.atOnceLimit"], undefined);
});

test("a voice cap that fails its own range gives no cue an at-once error", () => {
  const e = fresh();
  e.set(GLOBAL_COLUMN, "voiceCap", 0);
  const errors = errorsOf(e.get());
  assert.equal(errors["global.voiceCap"], "must be 1 to 128");
  assert.equal(Object.keys(errors).some((k) => k.endsWith(".atOnceLimit")), false);
});

test("the cross rules are the audio core's own, one column at a time", () => {
  assert.deepEqual(columnCrossErrors("ack", { atOnceLimit: 9 }, 8).map((x) => x.field), ["atOnceLimit"]);
  assert.deepEqual(columnCrossErrors("ack", { atOnceLimit: 9 }, undefined), []);
  assert.deepEqual(columnCrossErrors("global", { voiceCap: 8, reservedSlots: 8, zoomNear: 1, zoomFar: 2 }, undefined).map((x) => x.field), ["reservedSlots"]);
  assert.deepEqual(columnCrossErrors("global", { voiceCap: 8, reservedSlots: 2, zoomNear: 2, zoomFar: 2 }, undefined).map((x) => x.field), ["zoomNear"]);
});

test("every cell is relevant, and columns are named", () => {
  const rules = soundRules(() => undefined);
  assert.equal(rules.relevant(tuningToTable(DEFAULT_TUNING).ack!, "minGapSeconds"), true);
  assert.equal(soundLabel("shotDirect"), "shotDirect");
  assert.equal(soundLabel(GLOBAL_COLUMN), "Global");
});
