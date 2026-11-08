import assert from "node:assert/strict";
import { test } from "node:test";
import type { Unit } from "@mf/sim";
import { kindMembers } from "../src/game/controlGroups.ts";

const unit = (id: number, owner: number, kind: Unit["kind"]) => ({ id, owner, kind }) as Unit;

test("simple groups: group n is every own unit of its kind", () => {
  const units = [unit(1, 1, "factory"), unit(2, 2, "factory"), unit(3, 1, "tank"), unit(4, 1, "factory"), unit(5, 1, "mine"), unit(6, 1, "jammer")];
  assert.deepEqual(kindMembers(units, 1, 1), [1, 4]);
  assert.deepEqual(kindMembers(units, 1, 4), [3]);
  assert.deepEqual(kindMembers(units, 1, 7), [5]);
  assert.deepEqual(kindMembers(units, 1, 8), [6]);
});

test("simple groups: a key with no kind is empty", () => {
  const units = [unit(1, 1, "tank")];
  assert.deepEqual(kindMembers(units, 1, 9), []);
});
