import assert from "node:assert/strict";
import { test } from "node:test";
import type { Player } from "@mf/sim";
import { localOutcome } from "../src/match/localOutcome.ts";

const p = (id: number, team: number, alive: boolean): Player => ({ id, name: `p${id}`, color: 0, credits: 0, alive, connected: true, team });

test("two teams alive: the match goes on", () => {
  assert.equal(localOutcome([p(1, 1, true), p(2, 2, true)]).over, false);
});

test("one team left: every player on it wins, alive or not", () => {
  const r = localOutcome([p(1, 1, true), p(2, 1, false), p(3, 2, false)]);
  assert.deepEqual(r, { over: true, winners: ["p1", "p2"] });
});

test("nobody alive: over, no winners", () => {
  assert.deepEqual(localOutcome([p(1, 1, false), p(2, 2, false)]), { over: true, winners: [] });
});
