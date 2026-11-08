import { test } from "node:test";
import assert from "node:assert/strict";
import { createWorld, generateMap, spawnUnit, START_CREDITS, UNIT_STATS } from "@mf/sim";
import type { Ghost } from "../src/memory/memory.ts";
import { perceive } from "../src/perception/picture.ts";
import { chance } from "../src/worth/chance.ts";
import { enemyWorth } from "../src/worth/enemy.ts";
import { ownWorth } from "../src/worth/own.ts";
import { factoryWorth, harvesterWorth, HARVEST_RATE, REPLACE_TICKS, unitWorth } from "../src/worth/unit.ts";

const ghost = (id: number, kind: Ghost["kind"], hp: number | null = null): Ghost => ({ id, owner: 1, x: 0, y: 0, kind, mode: "mobile", hp, firstSeen: 0, lastSeen: 0 });

function picture(factories: number, credits: number) {
  const w = createWorld(generateMap(1, { width: 8000, height: 8000, cell: 125 }));
  w.features = [];
  w.players.push({ id: 0, name: "p", color: 0, credits, alive: true, connected: true, team: 0 });
  for (let n = 0; n < factories; n++) spawnUnit(w, 0, "factory", 1000 + n * 2000, 1000);
  spawnUnit(w, 0, "tank", 4000, 4000);
  return perceive(w, 0);
}

test("worth: a unit is worth its cost times its hp fraction", () => {
  assert.equal(unitWorth("tank"), UNIT_STATS.tank.cost);
  assert.equal(unitWorth("tank", UNIT_STATS.tank.maxHp / 2), UNIT_STATS.tank.cost / 2);
});

test("worth: a harvester carries its lost income until it is replaced", () => {
  assert.equal(harvesterWorth(), UNIT_STATS.harvester.cost + HARVEST_RATE * REPLACE_TICKS);
  assert.equal(harvesterWorth(UNIT_STATS.harvester.maxHp / 2), UNIT_STATS.harvester.cost / 2 + 1250);
});

test("worth: the life premium is the player's worth over its lives, so the last factory carries it all", () => {
  const one = ownWorth(picture(1, 1000));
  const two = ownWorth(picture(2, 1000));
  assert.equal(one.worth, 1000 + UNIT_STATS.factory.cost + UNIT_STATS.tank.cost);
  assert.equal(one.lifePremium, one.worth);
  assert.equal(two.lifePremium, two.worth / 2);
  assert.ok(factoryWorth(one.lifePremium) > factoryWorth(two.lifePremium));
  assert.equal(factoryWorth(0), UNIT_STATS.factory.cost + 1200);
});

test("enemy estimate: the start credits plus a guessed income, unless more was seen", () => {
  assert.equal(enemyWorth([], 0, 8).worth, START_CREDITS);
  assert.equal(enemyWorth([], 1000, 8).worth, START_CREDITS + 8000);
  const seen = [ghost(1, "factory"), ghost(2, "factory"), ghost(3, "tank")];
  const e = enemyWorth(seen, 0, 8);
  assert.equal(e.worth, 2 * UNIT_STATS.factory.cost + UNIT_STATS.tank.cost);
  assert.equal(e.lives, 2);
  assert.equal(enemyWorth([ghost(3, "tank")], 0, 8).lives, 1);
});

test("chance: the square law, and no enemy is a sure win", () => {
  assert.equal(chance(10, 10), 0.5);
  assert.ok(Math.abs(chance(20, 10) - 0.8) < 1e-12);
  assert.ok(Math.abs(chance(10, 20) - 0.2) < 1e-12);
  assert.equal(chance(0, 5), 0);
  assert.equal(chance(0, 0), 1);
});
