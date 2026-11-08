import assert from "node:assert/strict";
import { test } from "node:test";
import { DEFAULT_TUNING } from "../src/audio/defaultTuning.ts";
import { Throttle } from "../src/audio/throttle.ts";

const fromTuning = () => new Throttle((cue) => DEFAULT_TUNING.cues[cue].minGapSeconds);

test("a cue is held back inside its gap from the tuning", () => {
  const t = fromTuning();
  assert.equal(t.allow("underAttack", 10), true);
  assert.equal(t.allow("underAttack", 13.9), false);
  assert.equal(t.allow("underAttack", 14), true);
});

test("a held-back play does not restart the gap", () => {
  const t = fromTuning();
  t.allow("credits", 0);
  t.allow("credits", 2);
  assert.equal(t.allow("credits", 2.5), true);
});

test("a gap of 0 never throttles", () => {
  const t = fromTuning();
  assert.equal(DEFAULT_TUNING.cues.shellGround.minGapSeconds, 0);
  for (let i = 0; i < 5; i++) assert.equal(t.allow("shellGround", 1), true);
});

test("cues are throttled separately", () => {
  const t = fromTuning();
  t.allow("ack", 0);
  assert.equal(t.allow("queued", 0.01), true);
});

test("a changed gap takes effect at once", () => {
  let gap = 5;
  const t = new Throttle(() => gap);
  assert.equal(t.allow("ack", 0), true);
  assert.equal(t.allow("ack", 1), false);
  gap = 0.5;
  assert.equal(t.allow("ack", 1), true);
});
