import assert from "node:assert/strict";
import { test } from "node:test";
import type { MatchMsg } from "@mf/protocol";
import { TICK_MS, type Intent, type World } from "@mf/sim";
import { LocalHost } from "../src/app/localHost.ts";
import type { EndKind, MatchLink } from "../src/app/matchHost.ts";
import { sandboxWorld } from "../src/dev/sandboxWorld.ts";
import type { Guide } from "../src/game/tutorial/guide.ts";

const stopIntent = (unit: number): Intent => ({ t: "stop", units: [unit] });

/** A host over a fake clock and a link that records what the host drives. `fire()` runs one turn. */
function harness(world: World = sandboxWorld(7)) {
  const delivered: MatchMsg[] = [];
  const calls: string[] = [];
  const state = { guide: null as Guide | null, endCard: "match" as EndKind, sandbox: false };
  let tick: (() => void) | null = null;
  let interval = 0;
  let home = 0;
  const link: MatchLink = {
    deliver: (msg) => delivered.push(msg),
    world: () => world,
    paused: () => false,
    view: () => null,
    guide: (g) => {
      state.guide = g;
    },
    sandbox: (on) => {
      state.sandbox = on;
    },
    endCard: (kind) => {
      state.endCard = kind;
    },
    place: () => {},
    stop: () => {
      calls.push("stop");
      state.guide = null;
      state.sandbox = false;
      state.endCard = "match";
    },
  };
  const host = new LocalHost({
    onHome: () => home++,
    every: (ms, fn) => {
      interval = ms;
      tick = fn;
      return () => {
        tick = null;
      };
    },
  });
  host.attach(link);
  const turns = () => delivered.filter((m): m is Extract<MatchMsg, { t: "turn" }> => m.t === "turn");
  return {
    host, delivered, calls, state, turns, world,
    fire: () => tick?.(),
    get interval() {
      return interval;
    },
    get running() {
      return tick !== null;
    },
    get home() {
      return home;
    },
  };
}

test("play: welcome first, then one turn per tick carrying the intents sent since", () => {
  const h = harness();
  h.host.play({ world: h.world, you: 1, bots: [] });
  assert.equal(h.delivered[0]?.t, "welcome");
  assert.equal(h.interval, TICK_MS);
  assert.ok(h.host.active());
  h.host.intent(1, stopIntent(5));
  h.fire();
  assert.deepEqual(h.turns()[0], { t: "turn", tick: h.world.tick + 1, intents: [{ player: 1, intent: stopIntent(5) }] });
  h.fire();
  assert.deepEqual(h.turns()[1]?.intents, []);
});

test("leave: stops the clock, drops the match on the client and goes home", () => {
  const h = harness();
  h.host.play({ world: h.world, you: 1, bots: [] });
  h.host.leave();
  assert.ok(!h.running);
  assert.ok(!h.host.active());
  assert.equal(h.home, 1);
  assert.equal(h.calls.at(-1), "stop");
});

test("desync goes home like leave", () => {
  const h = harness();
  h.host.play({ world: h.world, you: 1, bots: [] });
  h.host.desync();
  assert.ok(!h.running);
  assert.equal(h.home, 1);
});

test("a new match first stops the one that ran", () => {
  const h = harness();
  h.host.play({ world: h.world, you: 1, bots: [] });
  h.host.play({ world: h.world, you: 2, bots: [] });
  const welcomes = h.delivered.filter((m) => m.t === "welcome");
  assert.equal(welcomes.length, 2);
  assert.deepEqual(welcomes.map((m) => (m.t === "welcome" ? m.you : -1)), [1, 2]);
  assert.equal(h.calls.length, 2);
});

test("sandbox: the link is told, and the client commands the first side", () => {
  const h = harness();
  h.host.sandbox();
  assert.equal(h.delivered[0]?.t, "welcome");
  assert.ok(h.state.sandbox);
  h.host.leave();
  assert.ok(!h.state.sandbox);
});

test("tutorial: a guide and the tutorial end card reach the link before the welcome", () => {
  const h = harness();
  h.host.tutorial();
  assert.ok(h.state.guide);
  assert.equal(h.state.endCard, "tutorial");
  assert.equal(h.delivered[0]?.t, "welcome");
  assert.ok(h.host.active());
  h.host.leave();
  assert.equal(h.state.guide, null);
  assert.equal(h.state.endCard, "match");
});

test("intents sent when no match runs are dropped", () => {
  const h = harness();
  h.host.intent(1, stopIntent(5));
  h.host.play({ world: h.world, you: 1, bots: [] });
  h.fire();
  assert.deepEqual(h.turns()[0]?.intents, []);
});

test("a host that was never attached refuses to play", () => {
  assert.throws(() => new LocalHost().play({ world: sandboxWorld(1), you: 1, bots: [] }), /not attached/);
});
