import assert from "node:assert/strict";
import { test } from "node:test";
import { DEFAULT_TUNING } from "../src/audio/defaultTuning.ts";
import { CUES, parseSoundTuning, serializeSoundTuning, TUNING_FIELDS, type TuningError } from "../src/audio/soundTuning.ts";
import { SYNTHS } from "../src/audio/synthVoices.ts";
import { SAMPLED_CUES } from "../src/audio/cues.ts";
import { RECIPES } from "../src/audio/recipes.ts";

/** A deep copy of the default as plain JSON, for a test to break. */
function raw(): any {
  return JSON.parse(serializeSoundTuning(DEFAULT_TUNING));
}

function errorsOf(json: unknown): TuningError[] {
  const r = parseSoundTuning(json);
  assert.equal(r.ok, false);
  return r.ok ? [] : r.errors;
}

function has(errors: TuningError[], column: string | null, field: string | null): boolean {
  return errors.some((e) => e.column === column && e.field === field);
}

test("the default tuning file parses", () => {
  assert.equal(parseSoundTuning(raw()).ok, true);
  assert.equal(DEFAULT_TUNING.global.voiceCap, 24);
});

test("CUES equals the cues of SYNTHS plus the sampled cues", () => {
  assert.deepEqual([...CUES].sort(), [...Object.keys(SYNTHS), ...SAMPLED_CUES].sort());
});

test("the sampled cues are the keys of RECIPES", () => {
  assert.deepEqual([...SAMPLED_CUES].sort(), Object.keys(RECIPES).sort());
});

test("every field of the list exists in the default", () => {
  for (const f of TUNING_FIELDS) {
    const row = f.scope === "global" ? DEFAULT_TUNING.global : DEFAULT_TUNING.cues.ack;
    assert.equal(typeof (row as unknown as Record<string, number>)[f.key], "number", f.key);
  }
});

test("serialize then parse gives the same tuning", () => {
  const text = serializeSoundTuning(DEFAULT_TUNING);
  assert.ok(text.endsWith("}\n"));
  const r = parseSoundTuning(JSON.parse(text));
  assert.ok(r.ok);
  assert.deepEqual(r.ok && r.tuning, DEFAULT_TUNING);
  assert.equal(serializeSoundTuning(r.ok ? r.tuning : DEFAULT_TUNING), text);
});

test("a value out of range is rejected", () => {
  const j = raw();
  j.cues.ack.rank = 1001;
  j.global.masterGain = 1.5;
  const e = errorsOf(j);
  assert.ok(has(e, "ack", "rank"));
  assert.ok(has(e, "global", "masterGain"));
});

test("too many decimals and fractional ints are rejected", () => {
  const j = raw();
  j.cues.ack.minGapSeconds = 0.123;
  j.cues.ack.atOnceLimit = 2.5;
  const e = errorsOf(j);
  assert.ok(has(e, "ack", "minGapSeconds"));
  assert.ok(has(e, "ack", "atOnceLimit"));
});

test("a non-number is rejected", () => {
  const j = raw();
  j.cues.ack.baseGain = "loud";
  assert.ok(has(errorsOf(j), "ack", "baseGain"));
});

test("an unknown cue, an unknown key and a missing cue are rejected", () => {
  const j = raw();
  j.cues.bang = j.cues.ack;
  j.cues.ack.extra = 1;
  delete j.cues.select;
  j.stray = 1;
  const e = errorsOf(j);
  assert.ok(has(e, "bang", null));
  assert.ok(has(e, "ack", "extra"));
  assert.ok(has(e, "select", null));
  assert.ok(has(e, null, "stray"));
});

test("a missing field is rejected", () => {
  const j = raw();
  delete j.global.zoomFar;
  assert.ok(has(errorsOf(j), "global", "zoomFar"));
});

test("cross rules are enforced", () => {
  const j = raw();
  j.global.reservedSlots = 24;
  j.global.zoomNear = 12000;
  j.cues.shellGround.atOnceLimit = 30;
  const e = errorsOf(j);
  assert.ok(has(e, "global", "reservedSlots"));
  assert.ok(has(e, "global", "zoomNear"));
  assert.ok(has(e, "shellGround", "atOnceLimit"));
});

test("every error is returned, not the first", () => {
  const j = raw();
  j.cues.ack.rank = -1;
  j.cues.queued.rank = -1;
  j.global.voiceCap = 0;
  j.global.maxGain = 9;
  assert.ok(errorsOf(j).length >= 4);
});

test("a non-object is rejected", () => {
  assert.equal(errorsOf(null).length, 1);
  assert.ok(errorsOf({ cues: 1, global: 2 }).length >= 2);
});
