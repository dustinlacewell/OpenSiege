import assert from "node:assert/strict";
import { test } from "node:test";
import type { Cue } from "../src/audio/cues.ts";
import { DEFAULT_TUNING } from "../src/audio/defaultTuning.ts";
import { admit } from "../src/audio/voiceBudget.ts";

// Default: cap 24, 4 reserved (slots 20..23), protected rank 500. shellGround rank 150 (12 at once), underAttack rank 1000 (1 at once), credits 900 (2 at once).
const T = DEFAULT_TUNING;

function active(total: number, ...per: [Cue, number][]) {
  return { total, byCue: new Map<Cue, number>(per) };
}

test("a free slot plays", () => {
  assert.equal(admit("shellGround", T, active(0)), "play");
});

test("a cue at its at-once limit is cueFull", () => {
  assert.equal(admit("shellGround", T, active(12, ["shellGround", 12])), "cueFull");
  assert.equal(admit("shellGround", T, active(11, ["shellGround", 11])), "play");
});

test("the total at the cap is capFull", () => {
  assert.equal(admit("credits", T, active(24, ["ack", 24])), "capFull");
  assert.equal(admit("shellGround", T, active(24)), "capFull");
});

test("the reserved slots block a low rank but let an alert through", () => {
  assert.equal(admit("shellGround", T, active(19)), "play");
  assert.equal(admit("shellGround", T, active(20)), "reserved");
  assert.equal(admit("underAttack", T, active(20)), "play");
  assert.equal(admit("underAttack", T, active(23)), "play");
});

test("an alert is refused only at the true cap", () => {
  assert.equal(admit("underAttack", T, active(24)), "capFull");
});

test("rank equal to the protected rank may use the reserved slots", () => {
  assert.equal(admit("select", T, active(22)), "play");
});

test("cueFull is checked before capFull", () => {
  assert.equal(admit("underAttack", T, active(24, ["underAttack", 1])), "cueFull");
});
