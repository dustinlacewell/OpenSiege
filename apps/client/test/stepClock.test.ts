import { test } from "node:test";
import assert from "node:assert/strict";
import { StepClock } from "../src/render/stepClock.ts";

test("the first frame runs no step", () => {
  const c = new StepClock(60, 4);
  assert.deepEqual({ ...c.advance(5) }, { dt: 0, steps: 0 });
});

test("steps follow the fixed rate across uneven frames", () => {
  const c = new StepClock(60, 4);
  c.advance(0);
  let steps = 0;
  for (let i = 1; i <= 144; i++) steps += c.advance(i / 144).steps;
  assert.ok(steps >= 59 && steps <= 60, `${steps}`);
});

test("a slow frame runs at most maxSteps and drops the rest", () => {
  const c = new StepClock(60, 4);
  c.advance(0);
  assert.equal(c.advance(0.09).steps, 4);
  assert.ok(c.advance(0.09 + 1 / 60).steps <= 2);
});

test("time going back runs nothing", () => {
  const c = new StepClock(60, 4);
  c.advance(1);
  assert.deepEqual({ ...c.advance(0.5) }, { dt: 0, steps: 0 });
});
