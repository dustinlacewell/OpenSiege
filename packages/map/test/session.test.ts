import assert from "node:assert/strict";
import { test } from "node:test";
import { emptyMap } from "../src/file.ts";
import { commitStroke, editBounds, newSession, redoLast, strokeDab, undoLast, type Edit, type Tool } from "../src/session.ts";

const mk = () => newSession(emptyMap({ name: "test", width: 8000, height: 8000, cell: 125, baseHeight: 300 }));
const COLS = 8000 / 125 + 1;
const raise: Tool = { kind: "height", op: "raise", brush: { radius: 400, strength: 20, falloff: 0.5 } };
const paint: Tool = { kind: "material", channel: 1, brush: { radius: 400, strength: 0.5, falloff: 0.5 } };

test("height tool produces and applies an edit", () => {
  const s = mk();
  const e = strokeDab(s, raise, 4000, 4000, 1);
  assert.equal(e?.t, "height");
  assert.ok(s.map.spec.heights[32 * COLS + 32]! > 300);
  assert.equal(s.undo.length, 0);
});

test("material tool produces and applies an edit", () => {
  const s = mk();
  const e = strokeDab(s, paint, 4000, 4000, 1);
  assert.equal(e?.t, "material");
  assert.ok(s.map.materials.weights[(32 * COLS + 32) * 4 + 1]! > 0);
});

test("feature place, scatter, erase", () => {
  const s = mk();
  const place: Tool = { kind: "feature", mode: "place", featureKind: "tree", radius: 100, density: 0 };
  assert.equal(strokeDab(s, place, 1000, 1000, 1)?.t, "features");
  assert.equal(s.map.spec.features.length, 1);
  const scatter: Tool = { kind: "feature", mode: "scatter", featureKind: "rock", radius: 1500, density: 20 };
  assert.equal(strokeDab(s, scatter, 4000, 4000, 7)?.t, "features");
  assert.ok(s.map.spec.features.length > 1);
  const erase: Tool = { kind: "feature", mode: "erase", featureKind: "tree", radius: 200, density: 0 };
  strokeDab(s, erase, 1000, 1000, 1);
  assert.ok(s.map.spec.features.every((f) => f.kind !== "tree"));
});

test("field place and erase", () => {
  const s = mk();
  const place: Tool = { kind: "field", mode: "place", radius: 300, amount: 4000 };
  assert.equal(strokeDab(s, place, 2000, 2000, 1)?.t, "fields");
  assert.equal(s.map.spec.fields.length, 1);
  const erase: Tool = { kind: "field", mode: "erase", radius: 100, amount: 0 };
  assert.equal(strokeDab(s, erase, 2050, 2000, 1)?.t, "fields");
  assert.equal(s.map.spec.fields.length, 0);
});

test("null when nothing changes", () => {
  const s = mk();
  const erase: Tool = { kind: "feature", mode: "erase", featureKind: "tree", radius: 100, density: 0 };
  assert.equal(strokeDab(s, erase, 500, 500, 1), null);
  const flat: Tool = { kind: "height", op: "smooth", brush: { radius: 400, strength: 5, falloff: 0.5 } };
  assert.equal(strokeDab(s, flat, 4000, 4000, 1), null);
});

test("multi-dab stroke is one undo entry; undo restores exact heights; redo reapplies", () => {
  const s = mk();
  const orig = [...s.map.spec.heights];
  const edits: Edit[] = [];
  for (const x of [3800, 3900, 4000, 4100]) {
    const e = strokeDab(s, raise, x, 4000, 1);
    if (e) edits.push(e);
  }
  const painted = [...s.map.spec.heights];
  commitStroke(s, edits);
  assert.equal(s.undo.length, 1);
  assert.equal(undoLast(s)?.t, "height");
  assert.deepEqual(s.map.spec.heights, orig);
  assert.equal(redoLast(s)?.t, "height");
  assert.deepEqual(s.map.spec.heights, painted);
  assert.equal(s.undo.length, 1);
});

test("commit clears redo", () => {
  const s = mk();
  const e = strokeDab(s, raise, 4000, 4000, 1)!;
  commitStroke(s, [e]);
  undoLast(s);
  assert.equal(s.redo.length, 1);
  commitStroke(s, [strokeDab(s, raise, 2000, 2000, 1)!]);
  assert.equal(s.redo.length, 0);
});

test("undo stack caps at 100", () => {
  const s = mk();
  for (let n = 0; n < 105; n++) commitStroke(s, [strokeDab(s, raise, 4000, 4000, n)!]);
  assert.equal(s.undo.length, 100);
});

test("mixed kinds commit as separate entries", () => {
  const s = mk();
  const a = strokeDab(s, raise, 4000, 4000, 1)!;
  const b = strokeDab(s, paint, 4000, 4000, 1)!;
  commitStroke(s, [a, b]);
  assert.equal(s.undo.length, 2);
});

test("editBounds", () => {
  const s = mk();
  const e = strokeDab(s, raise, 4000, 4000, 1)!;
  const b = editBounds(e, COLS)!;
  assert.ok(b.i0 <= 32 && b.i1 >= 32 && b.j0 <= 32 && b.j1 >= 32);
  assert.ok(b.i1 - b.i0 <= 8);
  const f = strokeDab(s, { kind: "feature", mode: "place", featureKind: "tree", radius: 1, density: 0 }, 10, 10, 1)!;
  assert.equal(editBounds(f, COLS), null);
});

test("feature scatter undo restores exact feature array", () => {
  const s = mk();
  const scatter: Tool = { kind: "feature", mode: "scatter", featureKind: "tree", radius: 1500, density: 20 };
  const orig = [...s.map.spec.features];
  const edits: Edit[] = [];
  for (const seed of [1, 2, 3]) {
    const e = strokeDab(s, scatter, 4000, 4000, seed);
    if (e) edits.push(e);
  }
  assert.ok(s.map.spec.features.length > 0);
  commitStroke(s, edits);
  assert.equal(s.undo.length, 1);
  undoLast(s);
  assert.deepEqual(s.map.spec.features, orig);
});
