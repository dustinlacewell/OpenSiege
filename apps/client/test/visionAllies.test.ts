import assert from "node:assert/strict";
import { test } from "node:test";
import { UNIT_STATS, type Player, type Terrain, type Unit, type World } from "@mf/sim";
import { alliedOwners, Vision } from "../src/game/vision.ts";

const flat = (): Terrain => ({ cols: 401, rows: 401, cell: 100, heights: new Array(401 * 401).fill(0), seaLevel: -100 });
const player = (id: number, team: number): Player => ({ id, name: `p${id}`, color: 0, credits: 0, alive: true, connected: true, team });
const tank = (id: number, owner: number, x: number, y = 20000): Unit => ({ id, owner, kind: "tank", x, y, mode: "mobile" }) as Unit;
const worldOf = (players: Player[], units: Unit[]): World => ({ terrain: flat(), tick: 1, players, units }) as unknown as World;

const SIGHT = UNIT_STATS.tank.sight;
const FAR = Math.max(SIGHT, UNIT_STATS.tank.radar) + 2000;

test("alliedOwners: me and my teammates, not the other team", () => {
  const players = [player(1, 1), player(2, 1), player(3, 2)];
  assert.deepEqual([...alliedOwners(players, 1)].sort(), [1, 2]);
  assert.deepEqual([...alliedOwners(players, 3)], [3]);
});

test("alliedOwners: a viewer that is no player has no allies", () => {
  assert.deepEqual([...alliedOwners([player(1, 0)], -1)], [-1]);
});

test("an ally's unit gives sight; an enemy in its sight is seen", () => {
  const ally = tank(1, 2, 10000);
  const enemy = tank(2, 3, 10000 + SIGHT / 2);
  const v = new Vision();
  v.update(worldOf([player(1, 1), player(2, 1), player(3, 2)], [ally, enemy]), 1, 0);
  assert.equal(v.level(enemy), "seen");
  assert.equal(v.sees(enemy.x, enemy.y), true);
});

test("without the ally, the same enemy is not seen", () => {
  const ally = tank(1, 2, 10000);
  const enemy = tank(2, 3, 10000 + SIGHT / 2);
  const v = new Vision();
  v.update(worldOf([player(1, 1), player(2, 2), player(3, 3)], [ally, enemy]), 1, 0);
  assert.equal(v.level(enemy), "none");
});

test("an ally far in the dark is still seen and its things still draw", () => {
  const mine = tank(1, 1, 2000);
  const ally = tank(2, 2, 2000 + FAR);
  const v = new Vision();
  v.update(worldOf([player(1, 1), player(2, 1)], [mine, ally]), 1, 0);
  assert.equal(v.level(ally), "seen");
  assert.equal(v.shows(ally), true);
  assert.equal(v.sees(ally.x + SIGHT * 0.9, ally.y), true);
  assert.equal(v.showsAt(2, 38000, 38000), true);
  assert.equal(v.showsAt(1, 38000, 38000), true);
});

test("an enemy in the dark stays hidden and its things do not draw", () => {
  const mine = tank(1, 1, 2000);
  const enemy = tank(2, 2, 2000 + FAR);
  const v = new Vision();
  v.update(worldOf([player(1, 1), player(2, 2)], [mine, enemy]), 1, 0);
  assert.equal(v.level(enemy), "none");
  assert.equal(v.shows(enemy), false);
  assert.equal(v.showsAt(2, enemy.x, enemy.y), false);
});

test("an ally is never a radar contact", () => {
  const mine = tank(1, 1, 2000);
  const ally = tank(2, 2, 2000 + SIGHT + 50);
  const v = new Vision();
  v.update(worldOf([player(1, 1), player(2, 1)], [mine, ally]), 1, 0);
  assert.equal(v.radarContacts().length, 0);
});
