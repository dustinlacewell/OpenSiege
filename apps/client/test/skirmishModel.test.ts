import assert from "node:assert/strict";
import { test } from "node:test";
import { MAX_SEATS } from "@mf/sim";
import { planErrors } from "../src/game/skirmish/planErrors.ts";
import {
  addBot, canAddBot, cycleBot, DEFAULT_NAME, initialSkirmish, joinTeam, playerName, problem, removeBot, setAuto, setMap, setName,
  setTeams, stepMap, toPlan, type SkirmishState,
} from "../src/ui/skirmish/skirmishModel.ts";
import { skirmishSections } from "../src/ui/skirmish/skirmishSections.ts";

const fresh = () => initialSkirmish("Ann");
const teamsOf = (s: SkirmishState) => [s.humanTeam, ...s.bots.map((b) => b.team)];
const grow = (s: SkirmishState, n: number) => Array.from({ length: n }).reduce<SkirmishState>((acc) => addBot(acc, null), s);

test("a fresh setup is free for all with one normal bot, and can be played", () => {
  const s = fresh();
  assert.equal(s.teams, 0);
  assert.deepEqual(s.bots.map((b) => b.difficulty), ["normal"]);
  assert.equal(problem(s), null);
  assert.deepEqual(planErrors(toPlan(s)), []);
});

test("free for all: each bot takes the lowest unused team number, to MAX_SEATS seats", () => {
  const s = grow(fresh(), 10);
  assert.equal(1 + s.bots.length, MAX_SEATS);
  assert.deepEqual(teamsOf(s), [0, 1, 2, 3, 4, 5, 6, 7]);
  assert.equal(canAddBot(s, null), false);
  assert.equal(addBot(s, null), s);
});

test("removing a bot frees its team number for the next one", () => {
  const s = addBot(addBot(fresh(), null), null);
  const gone = removeBot(s, 2);
  assert.deepEqual(teamsOf(gone), [0, 1, 3]);
  assert.deepEqual(teamsOf(addBot(gone, null)), [0, 1, 3, 2]);
});

test("cycling steps through the difficulties and wraps", () => {
  let s = fresh();
  const seen: string[] = [];
  for (let i = 0; i < 4; i++) {
    s = cycleBot(s, 1);
    seen.push(s.bots[0]!.difficulty);
  }
  assert.deepEqual(seen, ["hard", "easy", "normal", "hard"]);
  assert.equal(cycleBot(s, 99).bots[0]!.difficulty, s.bots[0]!.difficulty);
});

test("team games: a bot goes to the team asked for while it has a free seat; the cap is MAX_SEATS / teams", () => {
  let s = setTeams(fresh(), 2);
  assert.deepEqual(teamsOf(s), [0, 1]);
  s = addBot(addBot(addBot(s, 1), 1), 1);
  assert.deepEqual(teamsOf(s), [0, 1, 1, 1, 1]);
  assert.equal(canAddBot(s, 1), false);
  assert.equal(addBot(s, 1), s);
  assert.equal(canAddBot(s, 0), true);
  assert.deepEqual(teamsOf(addBot(s, null)), [0, 1, 1, 1, 1, 0]);
});

test("three teams hold two seats each, so at most six seats", () => {
  let s = setTeams(fresh(), 3);
  s = grow(s, 10);
  assert.equal(1 + s.bots.length, 6);
  assert.deepEqual([0, 1, 2].map((t) => teamsOf(s).filter((x) => x === t).length), [2, 2, 2]);
});

test("setTeams refuses a bad count and the same count", () => {
  const s = grow(fresh(), 3);
  assert.equal(setTeams(s, 1), s);
  assert.equal(setTeams(s, 5), s);
  assert.equal(setTeams(s, 0), s);
});

test("setTeams refuses a count whose teams cannot hold the seats", () => {
  const seven = grow(fresh(), 5);
  assert.equal(1 + seven.bots.length, 7);
  assert.equal(setTeams(seven, 3), seven);
  assert.equal(setTeams(seven, 4).teams, 4);
  assert.equal(setTeams(seven, 2).teams, 2);
});

test("setTeams spreads the seats over the teams, and back to free for all gives each seat its own number", () => {
  const s = setTeams(grow(fresh(), 2), 2);
  assert.deepEqual(teamsOf(s), [0, 1, 0, 1]);
  const back = setTeams(s, 0);
  assert.deepEqual(teamsOf(back), [0, 1, 2, 3]);
  assert.equal(back.teams, 0);
});

test("the human may join a team with a free seat, not in free for all", () => {
  const ffa = fresh();
  assert.equal(joinTeam(ffa, 1), ffa);
  const s = setTeams(fresh(), 2);
  assert.equal(joinTeam(s, 1).humanTeam, 1);
  assert.equal(joinTeam(s, 0), s);
  const full = addBot(addBot(addBot(s, 1), 1), 1);
  assert.equal(joinTeam(full, 1), full);
});

test("an opponent is needed: a bot on another team", () => {
  const none = removeBot(fresh(), 1);
  assert.equal(problem(none), "Add an opponent");
  assert.throws(() => toPlan(none));
  assert.equal(problem(setTeams(fresh(), 2)), null);
  const allies = joinTeam(setTeams(fresh(), 2), 1);
  assert.equal(problem(allies), "Put an opponent on another team");
  const sameSide = addBot(removeBot(setTeams(fresh(), 2), 1), 0);
  assert.equal(problem(sameSide), "Put an opponent on another team");
});

test("the name is trimmed, cut to 16 and falls back to Player", () => {
  assert.equal(playerName(setName(fresh(), "  Bo  ")), "Bo");
  assert.equal(playerName(setName(fresh(), "x".repeat(30))), "x".repeat(16));
  assert.equal(playerName(setName(fresh(), "   ")), DEFAULT_NAME);
});

test("maps: pick one, or step through the list with wrap; an unknown id steps from the first", () => {
  const ids = ["ford", "lagoon", null];
  assert.equal(setMap(fresh(), "ford").mapId, "ford");
  assert.equal(stepMap(setMap(fresh(), "ford"), ids, 1).mapId, "lagoon");
  assert.equal(stepMap(setMap(fresh(), "lagoon"), ids, 1).mapId, null);
  assert.equal(stepMap(setMap(fresh(), null), ids, 1).mapId, "ford");
  assert.equal(stepMap(setMap(fresh(), "ford"), ids, -1).mapId, null);
  assert.equal(stepMap(setMap(fresh(), "gone"), ids, 1).mapId, "lagoon");
  assert.equal(stepMap(fresh(), [], 1).mapId, null);
});

test("toPlan: the human first, bots named by id, the setup's teams, names and difficulties", () => {
  let s = setName(setTeams(fresh(), 2), "Ann");
  s = cycleBot(addBot(s, 0), 2);
  assert.deepEqual(toPlan(s), {
    name: "Ann",
    teams: 2,
    seats: [
      { kind: "human", team: 0 },
      { kind: "bot", name: "Bot 1", team: 1, difficulty: "normal" },
      { kind: "bot", name: "Bot 2", team: 0, difficulty: "hard" },
    ],
  });
});

test("auto is a flag on the setup", () => {
  assert.equal(setAuto(fresh(), true).auto, true);
  assert.equal(fresh().auto, false);
});

test("roster in free for all: one block with every seat, the human first", () => {
  const [only, ...rest] = skirmishSections(grow(fresh(), 1));
  assert.equal(rest.length, 0);
  assert.equal(only!.team, null);
  assert.deepEqual(only!.seats.map((x) => x.kind === "player" ? x.name : x.name), ["Ann", "Bot 1", "Bot 2"]);
  assert.equal(only!.canAddBot, true);
});

test("roster in teams: one block per team with counts, join and add-bot flags", () => {
  const s = addBot(addBot(addBot(setTeams(fresh(), 2), 1), 1), 1);
  const [t1, t2] = skirmishSections(s);
  assert.deepEqual([t1!.name, t1!.count, t1!.canJoin, t1!.canAddBot], ["Team 1", "1 / 4", false, true]);
  assert.deepEqual([t2!.name, t2!.count, t2!.canJoin, t2!.canAddBot], ["Team 2", "4 / 4", false, false]);
  assert.deepEqual(skirmishSections(setTeams(fresh(), 2)).map((x) => x.canJoin), [false, true]);
});
