import { test } from "node:test";
import assert from "node:assert/strict";
import {
  applySaved, cellId, changedCells, createEditor, errorsOf, merged, redo, remoteCells, restoreDraft, revertAll, revertCell,
  revertColumn, seal, setValue, stepValue, typeText, undo, withServerErrors, type EditorSpec, type EditorState,
} from "../src/dev/tableEditor/model.ts";
import { barFractions, revealPrefs, toggleSection, visibleKeys, type ViewPrefs } from "../src/dev/tableEditor/rows.ts";
import {
  cellText, formatValue, specFieldError, specOf, type FieldSpec, type Rules, type Schema, type Table,
} from "../src/dev/tableEditor/schema.ts";

// A made-up schema, so these tests prove the core and not the unit stats. Two decimal fields (gain 1 place, trim 1 place,
// master 2 places), one whole number, a switch and a select. `master` exists in the "global" column only.

const base = { unit: "", help: "" };
const schema: Schema = {
  sections: [{ id: "mix", label: "Mix" }, { id: "shape", label: "Shape" }],
  fields: [
    { ...base, key: "master", label: "Master", section: "mix", type: "number", min: 0, max: 1, decimals: 2, step: 0.01 },
    { ...base, key: "gain", label: "Gain", section: "mix", type: "number", min: 0, max: 2, decimals: 1, step: 0.1 },
    { ...base, key: "count", label: "Count", section: "shape", type: "number", min: 0, max: 100, decimals: 0, step: 1 },
    { ...base, key: "trim", label: "Trim", section: "shape", type: "number", min: -5, max: 5, decimals: 1, step: 0.1 },
    { ...base, key: "loop", label: "Loop", section: "shape", type: "bool" },
    { ...base, key: "wave", label: "Wave", section: "shape", type: "enum", options: ["sine", "saw"] },
  ],
};
const rules: Rules = {
  field: (_column, key, value) => specFieldError(specOf(schema, key)!, value),
  cross: (_column, row) => (row.loop === true && row.gain === 0 ? { gain: "a looping cue needs gain" } : {}),
  relevant: () => true,
};
const spec: EditorSpec = { schema, rules };
const table = (): Table => ({
  global: { master: 0.8 },
  a: { gain: 1, count: 4, trim: 0.1, loop: false, wave: "sine" },
  b: { gain: 0.5, count: 8, trim: 0, loop: true, wave: "saw" },
});
const fresh = (): EditorState => createEditor(spec, table());
const num = (key: string): Extract<FieldSpec, { type: "number" }> => specOf(schema, key) as Extract<FieldSpec, { type: "number" }>;
const count = (s: EditorState, column = "a"): number => s.draft[column]!.count as number;
const prefs = (over: Partial<ViewPrefs> = {}): ViewPrefs => ({ collapsed: [], filter: "", changedOnly: false, ...over });
const ids = (s: EditorState): string[] => changedCells(s).map((c) => cellId(c.column, c.field));

// Edits, history, drafts, view rows: the behaviour every table editor page gets

// Decimals

test("typing a decimal commits it to the draft", () => {
  const s = typeText(fresh(), "a", "gain", "1.5");
  assert.equal(s.draft.a!.gain, 1.5);
  assert.deepEqual(s.raw, {});
});

test("typing a decimal point mid-number commits the number and keeps no unparsed text", () => {
  assert.equal(typeText(fresh(), "a", "gain", "1.").draft.a!.gain, 1);
  assert.equal(typeText(fresh(), "a", "gain", ".5").draft.a!.gain, 0.5);
  assert.deepEqual(typeText(fresh(), "a", "gain", "1.").raw, {});
});

test("typing a minus sign alone, a lone point or two points stays as unparsed text with the number message", () => {
  for (const text of ["", "-", ".", "1.2.3", "abc", "1e3"]) {
    const s = typeText(fresh(), "a", "gain", text);
    assert.equal(s.draft.a!.gain, 1, text);
    assert.equal(errorsOf(s)["a.gain"], "must be a number", text);
  }
});

test("a whole-number field refuses a decimal point and says whole number", () => {
  const s = typeText(fresh(), "a", "count", "1.5");
  assert.equal(s.draft.a!.count, 4);
  assert.equal(errorsOf(s)["a.count"], "must be a whole number");
  assert.equal(typeText(fresh(), "a", "count", "12").draft.a!.count, 12);
});

test("typing -0 in a decimal field commits a plain zero", () => {
  assert.ok(Object.is(typeText(fresh(), "a", "trim", "-0.0").draft.a!.trim, 0));
});

test("typing more places than the field allows commits the value and marks the cell invalid", () => {
  const s = typeText(fresh(), "a", "gain", "1.25");
  assert.equal(s.draft.a!.gain, 1.25);
  assert.match(errorsOf(s)["a.gain"]!, /at most 1 decimal place/);
});

test("step adds delta times the field's step and does not drift (0.1 + 0.2 is 0.3)", () => {
  const s = stepValue(fresh(), "a", "trim", 2);
  assert.equal(s.draft.a!.trim, 0.3);
  const again = stepValue(stepValue(stepValue(fresh(), "b", "trim", 1), "b", "trim", 1), "b", "trim", 1);
  assert.equal(again.draft.b!.trim, 0.3);
});

test("step by a modifier factor moves ten or a hundred steps of the field", () => {
  assert.equal(stepValue(fresh(), "a", "trim", 10).draft.a!.trim, 1.1);
  assert.equal(stepValue(fresh(), "a", "count", 100).draft.a!.count, 100);
  assert.equal(stepValue(fresh(), "global", "master", 10).draft.global!.master, 0.9);
});

test("step clamps to the range of a decimal field", () => {
  assert.equal(stepValue(fresh(), "a", "gain", 1000).draft.a!.gain, 2);
  assert.equal(stepValue(fresh(), "a", "gain", -1000).draft.a!.gain, 0);
});

test("step starts from the draft value when the text is unparsed", () => {
  const typed = typeText(fresh(), "a", "gain", "");
  const s = stepValue(typed, "a", "gain", 1);
  assert.equal(s.draft.a!.gain, 1.1);
  assert.deepEqual(s.raw, {});
});

test("step does nothing to a switch or a select", () => {
  const s = fresh();
  assert.equal(stepValue(s, "a", "loop", 1), s);
  assert.equal(stepValue(s, "a", "wave", 1), s);
});

test("a decimal draft value is kept when the draft backup is restored, a decimal for a whole-number field is dropped", () => {
  const s = restoreDraft(spec, table(), [
    { column: "a", field: "gain", value: 1.5 },
    { column: "a", field: "count", value: 4.5 },
    { column: "a", field: "trim", value: Number.NaN },
    { column: "a", field: "trim", value: Infinity },
  ]);
  assert.deepEqual(changedCells(s).map((c) => [c.column, c.field, c.value]), [["a", "gain", 1.5]]);
});

test("field error: a number outside its range, a type that does not fit and too many places", () => {
  assert.equal(specFieldError(num("gain"), 2.5), "must be 0 to 2");
  assert.equal(specFieldError(num("gain"), "x"), "must be a number");
  assert.equal(specFieldError(num("count"), 1.5), "must be a whole number");
  assert.equal(specFieldError(num("gain"), Number.NaN), "must be a number");
  assert.equal(specFieldError(num("master"), 0.123), "must have at most 2 decimal places");
  assert.equal(specFieldError(num("gain"), 0.3), undefined);
  assert.equal(specFieldError(specOf(schema, "wave")!, "square"), "must be one of sine, saw");
  assert.equal(specFieldError(specOf(schema, "loop")!, 1), "must be true or false");
});

test("format shows a decimal field with a fixed count of places and other fields plainly", () => {
  assert.equal(formatValue(num("master"), 0.8), "0.80");
  assert.equal(formatValue(num("gain"), 1), "1.0");
  assert.equal(formatValue(num("count"), 7), "7");
  assert.equal(formatValue(specOf(schema, "wave")!, "saw"), "saw");
});

test("a number box shows an over-precise value as typed and any other value as format does", () => {
  assert.equal(cellText(num("master"), 1.005), "1.005");
  assert.equal(cellText(num("master"), 1.5), "1.50");
  assert.equal(cellText(num("count"), 7), "7");
  assert.equal(cellText(specOf(schema, "wave")!, "saw"), "saw");
});

// Ragged tables: the "global" column has only `master`, the cue columns do not have it.

test("changed cells skips fields a column leaves out and lists the rest in schema order", () => {
  let s = setValue(fresh(), "global", "master", 0.5);
  s = setValue(s, "b", "count", 9);
  s = setValue(s, "a", "gain", 1.2);
  assert.deepEqual(changedCells(s).map((c) => `${c.column}.${c.field}`), ["global.master", "a.gain", "b.count"]);
});

test("setting, typing or stepping a cell the column does not have changes nothing", () => {
  const s = fresh();
  assert.equal(setValue(s, "a", "master", 0.5), s);
  assert.equal(setValue(s, "global", "gain", 1), s);
  assert.equal(typeText(s, "a", "master", "0.5"), s);
  assert.equal(stepValue(s, "global", "count", 1), s);
  assert.equal(setValue(s, "ghost", "gain", 1), s);
  assert.equal(s.undo.length, 0);
});

test("errors skip fields a column leaves out", () => {
  assert.deepEqual(errorsOf(fresh()), {});
  const bad = setValue(setValue(fresh(), "global", "master", 5), "a", "gain", 9);
  assert.deepEqual(Object.keys(errorsOf(bad)).sort(), ["a.gain", "global.master"]);
});

test("the cross rule runs on a column once its present fields pass, and a missing field does not stop it", () => {
  const s = setValue(fresh(), "b", "gain", 0);
  assert.equal(errorsOf(s)["b.gain"], "a looping cue needs gain");
  const invalidElsewhere = setValue(s, "b", "count", 500);
  assert.equal(errorsOf(invalidElsewhere)["b.gain"], undefined);
  assert.ok(errorsOf(invalidElsewhere)["b.count"]);
});

test("bars: a column without the field gets 0 and the others scale among themselves", () => {
  const t: Table = { ...table(), c: { gain: 1, count: 2, trim: 0, loop: false, wave: "sine" } };
  const f = barFractions(schema, t, "gain");
  assert.deepEqual(f, { global: 0, a: 1, b: 0.5, c: 1 });
  assert.deepEqual(barFractions(schema, t, "master"), { global: 1, a: 0, b: 0, c: 0 });
  assert.ok(Object.values(barFractions(schema, t, "wave")).every((v) => v === 0));
});

test("draft restore drops a cell for a field the column does not have", () => {
  const s = restoreDraft(spec, table(), [
    { column: "a", field: "master", value: 0.5 },
    { column: "global", field: "gain", value: 1.5 },
    { column: "global", field: "master", value: 0.5 },
  ]);
  assert.deepEqual(changedCells(s).map((c) => `${c.column}.${c.field}`), ["global.master"]);
  assert.equal(s.undo.length, 1);
});

test("revert and undo work on a ragged table", () => {
  let s = setValue(fresh(), "global", "master", 0.5);
  s = setValue(s, "a", "gain", 1.5);
  assert.deepEqual(changedCells(revertColumn(s, "global")).map((c) => `${c.column}.${c.field}`), ["a.gain"]);
  assert.deepEqual(changedCells(revertCell(s, "a", "gain")).map((c) => `${c.column}.${c.field}`), ["global.master"]);
  assert.equal(changedCells(revertAll(s)).length, 0);
  assert.equal(changedCells(undo(undo(s))).length, 0);
  assert.equal(revertColumn(fresh(), "global").undo.length, 0);
});

test("set changes the draft, not the saved file, and lists the cell as changed", () => {
  const start = fresh();
  const s = setValue(start, "a", "count", 99);
  assert.equal(count(s), 99);
  assert.equal(s.saved.a!.count, start.saved.a!.count);
  assert.deepEqual(changedCells(s).map((c) => [c.column, c.field, c.saved, c.value]), [["a", "count", start.saved.a!.count, 99]]);
  assert.equal(merged(s).a!.count, 99);
});

test("setting the saved value again is no change", () => {
  const s = fresh();
  const same = setValue(s, "a", "count", s.saved.a!.count as number);
  assert.equal(same, s);
  assert.equal(changedCells(setValue(setValue(s, "a", "count", 5), "a", "count", s.saved.a!.count as number)).length, 0);
});

test("undo and redo walk the edits", () => {
  let s = seal(setValue(fresh(), "a", "count", 10));
  s = setValue(s, "a", "gain", 1.5);
  s = undo(s);
  assert.equal(s.draft.a!.gain, s.saved.a!.gain);
  assert.equal(count(s), 10);
  s = undo(s);
  assert.equal(changedCells(s).length, 0);
  s = redo(redo(s));
  assert.equal(count(s), 10);
  assert.equal(s.draft.a!.gain, 1.5);
  assert.equal(redo(s), s);
});

test("a new edit clears redo", () => {
  let s = undo(setValue(fresh(), "a", "count", 10));
  assert.equal(s.redo.length, 1);
  s = setValue(s, "a", "count", 11);
  assert.equal(s.redo.length, 0);
});

test("typing in one cell is one undo step until sealed", () => {
  let s = fresh();
  for (const v of [1, 12, 23]) s = setValue(s, "a", "count", v);
  assert.equal(s.undo.length, 1);
  s = seal(s);
  s = setValue(s, "a", "count", 34);
  assert.equal(s.undo.length, 2);
  assert.equal(count(undo(s)), 23);
  assert.equal(count(undo(undo(s))), count(fresh()));
});

test("edits to different cells do not join", () => {
  let s = setValue(fresh(), "a", "count", 1);
  s = setValue(s, "a", "gain", 1.5);
  s = setValue(s, "a", "count", 3);
  assert.equal(s.undo.length, 3);
});

test("a coalesced step that ends where it began leaves no step", () => {
  const s0 = fresh();
  const s = setValue(setValue(s0, "a", "count", 1), "a", "count", s0.saved.a!.count as number);
  assert.equal(s.undo.length, 0);
  assert.equal(changedCells(s).length, 0);
});

test("revert cell, column and all are each one undo step", () => {
  let s = fresh();
  for (const [column, field, v] of [["a", "count", 1], ["a", "gain", 1.5], ["b", "count", 3]] as const) s = seal(setValue(s, column, field, v));
  assert.deepEqual(ids(revertCell(s, "a", "count")), ["a.gain", "b.count"]);
  assert.deepEqual(ids(revertColumn(s, "a")), ["b.count"]);
  const all = revertAll(s);
  assert.equal(changedCells(all).length, 0);
  assert.equal(all.undo.length, s.undo.length + 1);
  assert.equal(changedCells(undo(all)).length, 3);
  assert.equal(revertAll(fresh()).undo.length, 0);
});

test("revert clears unparsed text in its scope", () => {
  let s = typeText(fresh(), "a", "count", "-");
  s = typeText(s, "b", "count", "");
  assert.deepEqual(Object.keys(revertCell(s, "a", "count").raw), ["b.count"]);
  assert.deepEqual(Object.keys(revertColumn(s, "b").raw), ["a.count"]);
  assert.deepEqual(Object.keys(revertAll(s).raw), []);
});

test("unparsed text is invalid and never reaches the draft", () => {
  const start = fresh();
  let s = typeText(start, "a", "count", "");
  assert.equal(count(s), count(start));
  assert.equal(errorsOf(s)["a.count"], "must be a whole number");
  s = typeText(s, "a", "count", "-");
  assert.equal(errorsOf(s)["a.count"], "must be a whole number");
  s = typeText(s, "a", "count", "1.5");
  assert.equal(count(s), count(start));
  s = typeText(s, "a", "count", " 42 ");
  assert.equal(count(s), 42);
  assert.deepEqual(s.raw, {});
  assert.equal(errorsOf(s)["a.count"], undefined);
});

test("typing -0 in a whole-number field commits a plain zero", () => {
  const s = typeText(fresh(), "a", "count", "-0");
  assert.ok(Object.is(count(s), 0));
});

test("step on a whole-number field moves by the delta, clamps to the range and joins one undo step", () => {
  let s = fresh();
  const start = count(s);
  s = stepValue(stepValue(s, "a", "count", 10), "a", "count", 1);
  assert.equal(count(s), start + 11);
  assert.equal(s.undo.length, 1);
  assert.equal(count(stepValue(s, "a", "count", -1_000_000)), 0);
  assert.equal(count(stepValue(s, "a", "count", 1_000_000)), 100);
});

test("step on a whole-number field starts from the draft value when the text is unparsed", () => {
  const s0 = typeText(fresh(), "a", "count", "");
  const s = stepValue(s0, "a", "count", 1);
  assert.equal(count(s), count(s0) + 1);
  assert.deepEqual(s.raw, {});
});

test("dev server refusals map to cells by column and clear when the cell is edited", () => {
  const errs = [{ column: "a", field: "count", message: "no" }, { column: null, field: null, message: "file" }];
  let s = withServerErrors(fresh(), errs);
  assert.deepEqual(remoteCells(s), { "a.count": "no" });
  s = setValue(s, "a", "count", 5);
  assert.deepEqual(remoteCells(s), {});
  assert.equal(s.remote.length, 1);
});

test("restoreDraft applies changed cells and drops the rest", () => {
  const saved = table();
  const s = restoreDraft(spec, saved, [
    { column: "a", field: "gain", value: 1.5 },
    { column: "a", field: "count", value: saved.a!.count },
    { column: "ghost", field: "count", value: 1 },
    { column: "a", field: "nope", value: 1 },
    { column: "a", field: "trim", value: "big" },
    { column: "a", field: "wave", value: "laser" },
    { column: "a", field: "count", value: 1.5 },
    { column: "b", field: "loop", value: !saved.b!.loop },
  ]);
  assert.deepEqual(ids(s), ["a.gain", "b.loop"]);
  assert.equal(s.undo.length, 2);
});

test("restoreDraft keeps an out-of-range number so the cell shows invalid", () => {
  const s = restoreDraft(spec, table(), [{ column: "a", field: "count", value: 99999 }]);
  assert.ok(errorsOf(s)["a.count"]);
});

test("applySaved makes the new file the baseline and empties history", () => {
  const s = setValue(fresh(), "a", "count", 5);
  const next = applySaved(s, merged(s));
  assert.equal(changedCells(next).length, 0);
  assert.equal(next.saved.a!.count, 5);
  assert.equal(next.undo.length, 0);
  assert.equal(next.remote.length, 0);
});

test("visible rows: filter, changed-only and collapsed sections", () => {
  const none = new Set<string>();
  assert.ok(visibleKeys(schema, prefs(), none).has("gain"));
  assert.ok(!visibleKeys(schema, prefs({ collapsed: ["mix"] }), none).has("gain"));
  assert.ok(visibleKeys(schema, prefs({ collapsed: ["mix"] }), none).has("count"));
  assert.deepEqual([...visibleKeys(schema, prefs({ filter: "gain" }), none)], ["gain"]);
  assert.ok(visibleKeys(schema, prefs({ filter: "gain", collapsed: ["mix"] }), none).has("gain"));
  assert.deepEqual([...visibleKeys(schema, prefs({ changedOnly: true }), new Set(["gain"]))], ["gain"]);
});

test("reveal opens the section and drops what hides the row", () => {
  const p = revealPrefs(schema, prefs({ collapsed: ["mix", "shape"], filter: "count", changedOnly: true }), "gain", new Set());
  assert.deepEqual(p, { collapsed: ["shape"], filter: "", changedOnly: false });
  const kept = revealPrefs(schema, prefs({ filter: "gain", changedOnly: true }), "gain", new Set(["gain"]));
  assert.deepEqual(kept, { collapsed: [], filter: "gain", changedOnly: true });
  assert.deepEqual(toggleSection(toggleSection(prefs(), "shape"), "shape").collapsed, []);
});
