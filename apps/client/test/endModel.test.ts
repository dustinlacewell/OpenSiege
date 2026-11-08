import { test } from "node:test";
import assert from "node:assert/strict";
import { endResult } from "../src/ui/endModel.ts";

const button = "Continue";

test("end: Victory when my name is among the winners", () => {
  assert.deepEqual(endResult(["ann"], "ann", button), { title: "Victory", tone: "won", line: "ann wins", button });
  assert.deepEqual(endResult(["ann", "bob"], "bob", button), { title: "Victory", tone: "won", line: "ann, bob win", button });
});

test("end: Defeat when winners are not me", () => {
  assert.deepEqual(endResult(["ann"], "bob", button), { title: "Defeat", tone: "lost", line: "ann wins", button });
  assert.equal(endResult(["ann", "cy"], "bob", button).line, "ann, cy win");
});

test("end: no winners is a neutral result", () => {
  assert.deepEqual(endResult([], "bob", button), { title: "Draw", tone: "", line: "No winner", button });
});

test("end: the button label is the host's", () => {
  assert.equal(endResult(["ann"], "ann", "Back to menu").button, "Back to menu");
});
