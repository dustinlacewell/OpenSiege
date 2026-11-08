import { test } from "node:test";
import assert from "node:assert/strict";
import { decodeWorld, encodeWorld, hashWorld, isEnemy, sameTeam, step, teamOf, type Intent, type SimState } from "../src/index.ts";
import { freshState, seat, TINY } from "./helpers.ts";

/** Players 1 and 2 on team 7, player 3 on team 8, player 4 on team 7 again. */
function seatedState(): SimState {
  const s = freshState(1, TINY);
  seat(s, 1, 7);
  seat(s, 2, 7);
  seat(s, 3, 8);
  return s;
}

const join = (player: number, x: number, intent: Partial<Extract<Intent, { t: "join" }>> = {}) =>
  ({ player, intent: { t: "join" as const, name: `p${player}`, x, y: 500, ...intent } });

test("teamOf reads the seat; an unknown player stands alone", () => {
  const s = seatedState();
  assert.equal(teamOf(s.world.players, 1), 7);
  assert.equal(teamOf(s.world.players, 3), 8);
  assert.notEqual(teamOf(s.world.players, 99), teamOf(s.world.players, 98));
  assert.notEqual(teamOf(s.world.players, 99), 7);
});

test("sameTeam: yourself, a teammate, a rival, an unknown player", () => {
  const { players } = seatedState().world;
  assert.ok(sameTeam(players, 1, 1));
  assert.ok(sameTeam(players, 1, 2));
  assert.ok(!sameTeam(players, 1, 3));
  assert.ok(sameTeam(players, 99, 99));
  assert.ok(!sameTeam(players, 99, 1));
});

test("isEnemy is the opposite of sameTeam", () => {
  const { players } = seatedState().world;
  assert.ok(!isEnemy(players, 1, 2));
  assert.ok(isEnemy(players, 1, 3));
  assert.ok(isEnemy(players, 3, 99));
  assert.ok(!isEnemy(players, 99, 99));
});

test("join with no team puts the player alone on team -1 - id", () => {
  const s = freshState(1, TINY);
  step(s, [join(5, 500), join(6, 1500)]);
  const [a, b] = s.world.players;
  assert.equal(a!.team, -6);
  assert.equal(b!.team, -7);
  assert.ok(isEnemy(s.world.players, 5, 6));
});

test("join with a team sets the team and takes the team's colour", () => {
  const s = freshState(1, TINY);
  step(s, [join(5, 500, { team: 3 })]);
  assert.equal(s.world.players[0]!.team, 3);
  assert.equal(s.world.players[0]!.color, 3);
});

test("teammates share a colour; lone players keep the colour of their id", () => {
  const s = freshState(1, TINY);
  step(s, [join(5, 300, { team: 3 }), join(6, 900, { team: 3 }), join(7, 1500), join(8, 1900)]);
  const colour = (id: number) => s.world.players.find((p) => p.id === id)!.color;
  assert.equal(colour(5), colour(6));
  assert.equal(colour(7), 7);
  assert.equal(colour(8), 8);
  assert.ok(sameTeam(s.world.players, 5, 6));
});

test("the hash and the codec see the team", () => {
  const s = seatedState();
  const base = hashWorld(s.world);
  s.world.players[0]!.team = 9;
  assert.notEqual(hashWorld(s.world), base);
  const back = decodeWorld(encodeWorld(s.world));
  assert.equal(back.players[0]!.team, 9);
  assert.equal(hashWorld(back), hashWorld(s.world));
});
