import assert from "node:assert/strict";
import { test } from "node:test";
import type { MatchMsg } from "@mf/protocol";
import { decodeWorld, DEFAULT_MAP_PARAMS, generateMap } from "@mf/sim";
import { LocalHost } from "../src/app/localHost.ts";
import type { MatchLink } from "../src/app/matchHost.ts";
import type { Placement } from "../src/game/placement.ts";
import type { SkirmishSetup } from "../src/game/skirmish/plan.ts";
import { FFA_PLAN } from "./support/skirmishFixtures.ts";

const SEED = 9;
const setup = (auto: boolean): SkirmishSetup => ({ draw: { info: null, spec: (seed) => generateMap(seed, DEFAULT_MAP_PARAMS) }, plan: FFA_PLAN, auto });

/** A host over a fake clock and a link that records the placements and messages. */
function harness() {
  const delivered: MatchMsg[] = [];
  const placed: (Placement | null)[] = [];
  let stops = 0;
  let home = 0;
  const link: MatchLink = {
    deliver: (msg) => delivered.push(msg),
    world: () => null,
    paused: () => false,
    view: () => null,
    guide: () => {},
    sandbox: () => {},
    endCard: () => {},
    place: (p) => placed.push(p),
    stop: () => stops++,
  };
  const host = new LocalHost({ onHome: () => home++, every: () => () => {}, seed: () => SEED });
  host.attach(link);
  return { host, delivered, placed, get stops() { return stops; }, get home() { return home; } };
}

test("Auto starts the match at once, with no pick", () => {
  const h = harness();
  h.host.skirmish(setup(true));
  assert.deepEqual(h.placed, []);
  assert.equal(h.host.active(), true);
  const welcome = h.delivered[0];
  assert.equal(welcome?.t, "welcome");
  if (welcome?.t === "welcome") assert.equal(welcome.you, 1);
});

test("Play without Auto shows the pick with the bots marked; the match starts on the click", () => {
  const h = harness();
  h.host.skirmish(setup(false));
  assert.equal(h.placed.length, 1);
  assert.equal(h.host.active(), true, "the start screen goes away for the pick");
  assert.equal(h.delivered.length, 0);
  const p = h.placed[0]!;
  assert.deepEqual(p.view(0).marks.map((m) => m.id), [2, 3]);
  p.onPick(8000, 8000);
  assert.equal(h.delivered[0]?.t, "welcome");
  assert.equal(h.host.active(), true);
});

test("Leave in the pick goes home and the match never starts", () => {
  const h = harness();
  h.host.skirmish(setup(false));
  h.placed[0]!.leave();
  assert.equal(h.home, 1);
  assert.equal(h.host.active(), false);
  assert.equal(h.delivered.length, 0);
});

test("the match starts on the click and keeps the bot spots the pick showed", () => {
  const h = harness();
  h.host.skirmish(setup(false));
  const p = h.placed[0]!;
  const shown = p.view(0).marks;
  p.onPick(2000, 14000);
  const welcome = h.delivered[0];
  assert.equal(welcome?.t, "welcome");
  if (welcome?.t !== "welcome") return;
  const factories = decodeWorld(welcome.world).units.filter((u) => u.kind === "factory");
  const mine = factories.find((u) => u.owner === 1)!;
  assert.ok(Math.hypot(mine.x - 2000, mine.y - 14000) < 250);
  for (const m of shown) {
    const f = factories.find((u) => u.owner === m.id)!;
    assert.ok(Math.hypot(f.x - m.x, f.y - m.y) < 250, `${m.name} moved`);
  }
});

test("a map that cannot be made leaves the host idle", () => {
  const h = harness();
  const quiet = console.error;
  console.error = () => {};
  try {
    h.host.skirmish({ ...setup(false), draw: { info: null, spec: () => { throw new Error("bad map"); } } });
  } finally {
    console.error = quiet;
  }
  assert.equal(h.host.active(), false);
  assert.deepEqual(h.placed, []);
});
