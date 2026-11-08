import { test } from "node:test";
import assert from "node:assert/strict";
import type { Intent, World } from "@mf/sim";
import { tutorialEnemy } from "../src/game/tutorial/enemy.ts";
import type { EnemyScript, Lesson, NoteStep } from "../src/game/tutorial/types.ts";

const w = { units: [] } as unknown as World;
const stop = (unit: number): Intent => ({ t: "stop", units: [unit] });

function note(id: string, enemy?: EnemyScript): NoteStep {
  return { t: "note", id, prompt: id, focus: { controls: [], units: () => [], zones: [] }, ...(enemy ? { enemy } : {}) };
}

function setup(...steps: NoteStep[]) {
  const lesson: Lesson = { zones: [], steps };
  let index: number | null = 0;
  const bot = tutorialEnemy(lesson, { stepIndex: () => index }, 2);
  return { bot, go: (i: number | null) => void (index = i) };
}

test("tutorial enemy: a step's intents go out once, on the first think in that step", () => {
  const seen: number[] = [];
  const { bot, go } = setup(note("a", (_w, me) => (seen.push(me), [stop(1)])), note("b"), note("c", () => [stop(3)]));
  assert.equal(bot.player, 2);
  assert.deepEqual(bot.think(w, 2), [stop(1)]);
  assert.deepEqual(bot.think(w, 2), []);
  assert.deepEqual(seen, [2]);
  go(1);
  assert.deepEqual(bot.think(w, 2), []);
  go(2);
  assert.deepEqual(bot.think(w, 2), [stop(3)]);
  assert.deepEqual(bot.think(w, 2), []);
});

test("tutorial enemy: steps passed between thinks fire in order", () => {
  const { bot, go } = setup(note("a", () => [stop(1)]), note("b", () => [stop(2)]), note("c", () => [stop(3)]));
  go(2);
  assert.deepEqual(bot.think(w, 2), [stop(1), stop(2), stop(3)]);
  assert.deepEqual(bot.think(w, 2), []);
});

test("tutorial enemy: a finished lesson sends nothing", () => {
  const { bot, go } = setup(note("a", () => [stop(1)]));
  go(null);
  assert.deepEqual(bot.think(w, 2), []);
});
