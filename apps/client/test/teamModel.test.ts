import { test } from "node:test";
import assert from "node:assert/strict";
import { byTeam, choiceLabel, mayJoinTeam, modeLabel, TEAM_CHOICES, teamCapacity, teamColor, teamName } from "../src/ui/teamModel.ts";

test("team names are the team number plus one; the colour is the team number", () => {
  assert.equal(teamName(0), "Team 1");
  assert.equal(teamName(3), "Team 4");
  assert.equal(teamColor(2), 2);
});

test("capacity: floor(8 / teams), the whole match in free for all", () => {
  assert.deepEqual([2, 3, 4].map(teamCapacity), [4, 2, 2]);
  assert.equal(teamCapacity(0), 8);
});

test("mode and selector labels", () => {
  assert.equal(modeLabel(0), "Free for all");
  assert.equal(modeLabel(2), "2 teams");
  assert.deepEqual(TEAM_CHOICES, [0, 2, 3, 4]);
  assert.deepEqual(TEAM_CHOICES.map(choiceLabel), ["Free for all", "2", "3", "4"]);
});

test("mayJoinTeam: a seated player, another team with room, in a team match", () => {
  const me = { team: 0, spectator: false };
  assert.equal(mayJoinTeam(2, me, 1, 3), true);
  assert.equal(mayJoinTeam(2, me, 1, 4), false);
  assert.equal(mayJoinTeam(2, me, 0, 1), false);
  assert.equal(mayJoinTeam(0, me, 1, 0), false);
  assert.equal(mayJoinTeam(2, { team: 0, spectator: true }, 1, 0), false);
  assert.equal(mayJoinTeam(2, undefined, 1, 0), false);
  assert.equal(mayJoinTeam(4, me, 1, 1), true);
  assert.equal(mayJoinTeam(4, me, 1, 2), false);
});

test("byTeam groups by team, lowest first, keeping order within a team", () => {
  const seats = [{ n: "a", team: 3 }, { n: "b", team: 1 }, { n: "c", team: 3 }, { n: "d", team: 1 }, { n: "e", team: 0 }];
  assert.deepEqual(byTeam(seats).map((s) => s.n), ["e", "b", "d", "a", "c"]);
  assert.deepEqual(seats.map((s) => s.n), ["a", "b", "c", "d", "e"]);
});
