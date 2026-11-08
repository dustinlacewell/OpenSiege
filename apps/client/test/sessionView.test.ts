import { test } from "node:test";
import assert from "node:assert/strict";
import { Session } from "../src/game/session.ts";
import type { Lockstep } from "../src/game/lockstep.ts";

/** A session whose world holds players 1 and 2, alive as given. */
function session(self: number, alive: [boolean, boolean] = [true, true]): Session {
  const world = { players: [{ id: 1, alive: alive[0] }, { id: 2, alive: alive[1] }], units: [] };
  const s = new Session();
  s.start(self, { world } as unknown as Lockstep);
  return s;
}

test("a spectator starts in the overview and can take a player's view and leave it", () => {
  const s = session(0);
  assert.deepEqual([s.watching, s.overview, s.viewing], [true, true, false]);
  s.viewAs(2);
  assert.deepEqual([s.me, s.self, s.overview, s.viewing], [2, 0, false, true]);
  s.viewAs(null);
  assert.deepEqual([s.me, s.overview, s.viewing], [0, true, false]);
});

test("a playing client cannot change its view", () => {
  const s = session(1);
  assert.equal(s.watching, false);
  s.viewAs(2);
  assert.deepEqual([s.me, s.viewing], [1, false]);
});

test("a player who is out may watch the others", () => {
  const s = session(1, [false, true]);
  assert.equal(s.watching, true);
  s.viewAs(2);
  assert.equal(s.me, 2);
  assert.equal(s.viewing, true);
});

test("changing the view clears the selection", () => {
  const s = session(0);
  s.select([5]);
  s.viewAs(1);
  assert.deepEqual(s.selected, []);
});
