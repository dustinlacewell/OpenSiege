import assert from "node:assert/strict";
import { test } from "node:test";
import { createSimState, decodeWorld, hashWorld, step, type SimState } from "@mf/sim";
import { LocalMatch } from "../src/match/localMatch.ts";
import type { SkirmishPlan } from "../src/game/skirmish/plan.ts";
import { skirmishWorld } from "../src/game/skirmish/world.ts";
import { FFA_PLAN, mapFor, TEAM_PLAN } from "./support/skirmishFixtures.ts";

const TURNS = 200;

/** Plays `TURNS` turns of a skirmish on a fake clock, stepping a client copy of the world as the client does. */
function play(plan: SkirmishPlan, seed: number) {
  const start = skirmishWorld(mapFor(seed), plan, seed, null);
  let sim: SimState | null = null;
  let fire: (() => void) | null = null;
  let intents = 0;
  let ended: string[] | null = null;
  const warnings: unknown[][] = [];
  const warn = console.warn;
  console.warn = (...args: unknown[]) => warnings.push(args);
  try {
    const match = new LocalMatch({
      deliver: (msg) => {
        if (msg.t === "welcome") sim = createSimState(decodeWorld(msg.world));
        else if (msg.t === "turn" && sim) {
          intents += msg.intents.length;
          step(sim, msg.intents);
        } else if (msg.t === "ended") ended = msg.winners;
      },
      world: () => sim?.world ?? null,
      every: (_, fn) => {
        fire = fn;
        return () => {
          fire = null;
        };
      },
    });
    match.start(start.world, start.you, start.bots);
    for (let i = 0; i < TURNS && fire; i++) (fire as () => void)();
  } finally {
    console.warn = warn;
  }
  return { hash: hashWorld(sim!.world), tick: sim!.world.tick, intents, ended, warnings };
}

test("one human and two bots of different difficulty play 200 turns: no bot throws, the bots act", () => {
  const r = play(FFA_PLAN, 21);
  assert.deepEqual(r.warnings, []);
  assert.equal(r.tick, TURNS + 1);
  assert.ok(r.intents > 0, "the bots sent intents");
  assert.equal(r.ended, null);
});

test("the same seed gives the same world after 200 turns; another seed does not", () => {
  assert.equal(play(FFA_PLAN, 21).hash, play(FFA_PLAN, 21).hash);
  assert.notEqual(play(FFA_PLAN, 21).hash, play(FFA_PLAN, 22).hash);
});

test("a team skirmish runs the same way", () => {
  const r = play(TEAM_PLAN, 5);
  assert.deepEqual(r.warnings, []);
  assert.ok(r.intents > 0);
  assert.equal(r.hash, play(TEAM_PLAN, 5).hash);
});
