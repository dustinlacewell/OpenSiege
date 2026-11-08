import { test } from "node:test";
import assert from "node:assert/strict";
import { emptiestTeam, freeTeam, rehome, teamCap, teamHasRoom, validTeams } from "../src/index.ts";

test("freeTeam: lowest unused, past MAX_SEATS when all are used", () => {
  assert.equal(freeTeam([]), 0);
  assert.equal(freeTeam([0, 1, 3]), 2);
  assert.equal(freeTeam([1, 2]), 0);
  assert.equal(freeTeam([0, 1, 2, 3, 4, 5, 6, 7, 9]), 8);
  assert.equal(freeTeam([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]), 10);
});

test("validTeams: 0 or 2..4 integers", () => {
  for (const ok of [0, 2, 3, 4]) assert.ok(validTeams(ok));
  for (const bad of [1, 5, -1, 2.5, NaN, Infinity]) assert.equal(validTeams(bad), false);
});

test("teamCap, teamHasRoom, emptiestTeam", () => {
  assert.deepEqual([2, 3, 4].map(teamCap), [4, 2, 2]);
  assert.ok(teamHasRoom([0, 0, 0], 2, 0));
  assert.equal(teamHasRoom([0, 0, 0, 0], 2, 0), false);
  for (const bad of [-1, 2, 1.5, NaN]) assert.equal(teamHasRoom([], 2, bad), false);
  assert.equal(teamHasRoom([], 0, 0), false);
  assert.equal(emptiestTeam([], 3), 0);
  assert.equal(emptiestTeam([0, 1, 1], 3), 2);
  assert.equal(emptiestTeam([0, 1, 0, 1], 2), 0);
  assert.equal(emptiestTeam([0, 0, 1, 1, 1, 2, 2, 3], 4), 3);
  assert.equal(emptiestTeam([0, 0, 1, 1, 2, 2], 3), null);
});

test("rehome: pure cases", () => {
  assert.deepEqual(rehome([5, 5, 5], 3, 0), [0, 1, 2]);
  assert.deepEqual(rehome([0, 1, 2, 3, 4], 0, 2), [0, 1, 0, 1, 0]);
  assert.deepEqual(rehome([0, 0, 1, 1, 2, 2], 3, 2), [0, 0, 1, 1, 0, 1]);
  assert.deepEqual(rehome([], 2, 3), []);
});
