import assert from "node:assert/strict";
import { test } from "node:test";
import type { MatchMsg } from "@mf/protocol";
import { decodeWorld, TICK_MS, type Intent, type World } from "@mf/sim";
import { sandboxWorld } from "../src/dev/sandboxWorld.ts";
import { LocalMatch, type LocalBot } from "../src/match/localMatch.ts";

const stopIntent = (unit: number): Intent => ({ t: "stop", units: [unit] });

/** A match with a fake timer and a fake deliver. `fire()` runs one turn. */
function harness(world: World = sandboxWorld(7), paused?: () => boolean) {
  const sent: MatchMsg[] = [];
  let tick: (() => void) | null = null;
  let interval = 0;
  let cancelled = 0;
  const match = new LocalMatch({
    deliver: (msg) => sent.push(msg),
    world: () => world,
    ...(paused ? { paused } : {}),
    every: (ms, fn) => {
      interval = ms;
      tick = fn;
      return () => {
        cancelled++;
        tick = null;
      };
    },
  });
  const turns = () => sent.filter((m): m is Extract<MatchMsg,{ t: "turn" }> => m.t === "turn");
  return {
    match,
    sent,
    turns,
    fire: () => tick?.(),
    get interval() {
      return interval;
    },
    get cancelled() {
      return cancelled;
    },
    get running() {
      return tick !== null;
    },
  };
}

const bot = (player: number, think: (world: World, me: number) => Intent[]): LocalBot => ({ player, think });

test("welcome carries the given world and you, then the clock runs at TICK_MS", () => {
  const world = sandboxWorld(3);
  const h = harness(world);
  h.match.start(world, 2);
  const welcome = h.sent[0];
  assert.equal(welcome?.t, "welcome");
  if (welcome?.t !== "welcome") return;
  assert.equal(welcome.you, 2);
  const got = decodeWorld(welcome.world);
  assert.equal(got.tick, world.tick);
  assert.deepEqual(got.players, world.players);
  assert.equal(h.interval, TICK_MS);
  assert.ok(h.running);
});

test("queued player intents arrive in the next turn, stamped", () => {
  const world = sandboxWorld(1);
  const h = harness(world);
  h.match.start(world, 1);
  h.match.send(1, stopIntent(5));
  h.fire();
  assert.deepEqual(h.turns()[0], { t: "turn", tick: world.tick + 1, intents: [{ player: 1, intent: stopIntent(5) }] });
  h.fire();
  assert.deepEqual(h.turns()[1]?.intents, []);
});

test("a bot's intents arrive in the turn after it thinks, stamped with its player", () => {
  const h = harness();
  const seen: number[] = [];
  h.match.start(sandboxWorld(7), 1, [bot(2, (_w, me) => (seen.push(me), [stopIntent(9)]))]);
  assert.deepEqual(seen, []);
  h.fire();
  assert.deepEqual(h.turns()[0]?.intents, []);
  assert.deepEqual(seen, [2]);
  h.fire();
  assert.deepEqual(h.turns()[1]?.intents, [{ player: 2, intent: stopIntent(9) }]);
});

test("join and leave are dropped, from players and bots", () => {
  const h = harness();
  h.match.start(sandboxWorld(7), 1, [bot(2, () => [{ t: "join", name: "x" }, { t: "leave" }, stopIntent(1)])]);
  h.match.send(1, { t: "leave" });
  h.match.send(1, { t: "join", name: "y" });
  h.fire();
  assert.deepEqual(h.turns()[0]?.intents, []);
  h.fire();
  assert.deepEqual(h.turns()[1]?.intents, [{ player: 2, intent: stopIntent(1) }]);
});

test("a bot keeps at most 60 intents per turn", () => {
  const h = harness();
  h.match.start(sandboxWorld(7), 1, [bot(2, () => Array.from({ length: 100 }, (_, i) => stopIntent(i)))]);
  h.fire();
  h.fire();
  const intents = h.turns()[1]?.intents ?? [];
  assert.equal(intents.length, 60);
  assert.deepEqual(intents[59], { player: 2, intent: stopIntent(59) });
});

test("a throwing bot gives nothing, is warned once, and the match keeps ticking", (t) => {
  const warn = t.mock.method(console, "warn", () => {});
  const h = harness();
  h.match.start(sandboxWorld(7), 1, [
    bot(2, () => {
      throw new Error("boom");
    }),
  ]);
  h.fire();
  h.fire();
  h.fire();
  assert.equal(h.turns().length, 3);
  assert.ok(h.turns().every((m) => m.intents.length === 0));
  assert.equal(warn.mock.callCount(), 1);
  assert.ok(h.running);
});

test("while paused, no turn goes out and no bot thinks; queued intents wait", () => {
  let paused = true;
  const world = sandboxWorld(7);
  const h = harness(world, () => paused);
  let thinks = 0;
  h.match.start(world, 1, [bot(2, () => (thinks++, []))]);
  h.match.send(1, stopIntent(5));
  h.fire();
  h.fire();
  assert.equal(h.turns().length, 0);
  assert.equal(thinks, 0);
  assert.ok(h.running);
  paused = false;
  h.fire();
  assert.deepEqual(h.turns()[0], { t: "turn", tick: world.tick + 1, intents: [{ player: 1, intent: stopIntent(5) }] });
  assert.equal(thinks, 1);
});

test("stop cancels the timer", () => {
  const h = harness();
  h.match.start(sandboxWorld(7), 1);
  h.match.stop();
  assert.equal(h.cancelled, 1);
  assert.equal(h.running, false);
});
