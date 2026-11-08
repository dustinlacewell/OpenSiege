import { test } from "node:test";
import assert from "node:assert/strict";
import { createWorld, generateMap, mapSize, spawnUnit, type Player, type World } from "@mf/sim";
import { buildThreat, threatAt } from "../src/assess/threat.ts";
import { groupGhosts } from "../src/assess/groups.ts";
import { updateGhosts } from "../src/memory/ghosts.ts";
import { perceive } from "../src/perception/picture.ts";

const player = (id: number, team: number): Player => ({ id, name: `p${id}`, color: 0, credits: 0, alive: true, connected: true, team });

/** Player 0 (me) and player 1 beside each other, each with a tank. Player 1 is on team `team1`. */
function pair(team1: number): World {
  const world = createWorld(generateMap(1, { width: 2000, height: 2000, cell: 125 }));
  world.features = [];
  world.players.push(player(0, 0), player(1, team1));
  spawnUnit(world, 0, "tank", 1000, 1000);
  spawnUnit(world, 1, "tank", 1100, 1000);
  return world;
}

/** Everything a bot derives from the other player's tank, one tick in. */
function derive(world: World) {
  const pic = perceive(world, 0);
  const ghosts = updateGhosts(new Map(), pic);
  const list = [...ghosts.values()];
  const map = mapSize(world.terrain);
  return { pic, ghosts, list, threat: buildThreat(list, map), groups: groupGhosts(list, map) };
}

test("an enemy's unit is a contact, a ghost, a threat and a target group", () => {
  const d = derive(pair(1));
  assert.equal(d.pic.contacts.length, 1);
  assert.equal(d.ghosts.size, 1);
  assert.ok(threatAt(d.threat, { x: 1100, y: 1000 }) > 0);
  assert.ok(d.groups.length > 0);
});

test("an ally's unit is no contact, no ghost, no threat and no target group", () => {
  const d = derive(pair(0));
  assert.equal(d.pic.contacts.length, 0);
  assert.equal(d.ghosts.size, 0);
  assert.equal(threatAt(d.threat, { x: 1100, y: 1000 }), 0);
  assert.equal(d.groups.length, 0);
});

test("a unit of a player missing from the player list is an enemy", () => {
  const world = pair(1);
  world.players.pop();
  assert.equal(perceive(world, 0).contacts.length, 1);
});
