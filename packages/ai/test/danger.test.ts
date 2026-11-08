import { test } from "node:test";
import assert from "node:assert/strict";
import { UNIT_STATS, type UnitKind, type UnitMode } from "@mf/sim";
import { ghostPower } from "../src/assess/power.ts";
import { buildThreat, reachOf, threatAt } from "../src/assess/threat.ts";
import { cellIndex, emptyGrid, fade, stamp } from "../src/danger/grid.ts";
import { liveDanger } from "../src/danger/live.ts";
import { dangerAlong, dangerAt, safestNear } from "../src/danger/query.ts";
import { emptyScar, updateScar, type ScarInputs } from "../src/danger/scar.ts";
import { KNOBS } from "../src/knobs.ts";
import type { Ghost } from "../src/memory/memory.ts";

const MAP = { width: 16000, height: 16000 };
const HALF = KNOBS.hard.danger;

const ghost = (kind: UnitKind | null, mode: UnitMode | null, x: number, y: number, id = 1): Ghost =>
  ({ id, owner: 9, x, y, kind, mode, hp: null, firstSeen: 0, lastSeen: 0 });

const at = (g: ReturnType<typeof emptyGrid>, x: number, y: number): number => g.values[cellIndex(g, x, y)]!;

/** No events, no eyes, nothing live. */
function inputs(extra: Partial<ScarInputs> = {}): ScarInputs {
  return { forgotten: [], known: [], hurts: [], losses: [], eyes: [], live: emptyGrid(MAP), ...extra };
}

const hurt = (x: number, y: number) => ({ id: 1, kind: "harvester" as const, x, y, amount: 40, rate: 10, tick: 0 });

test("stamp: full power out to half the reach, linear to zero at the reach", () => {
  const g = emptyGrid(MAP);
  stamp(g, 4200, 4200, 10, 2000);
  assert.equal(at(g, 4200, 4200), 10);
  assert.equal(at(g, 4200 + 800, 4200), 10);
  assert.ok(Math.abs(at(g, 4200 + 1600, 4200) - 4) < 1e-9);
  assert.equal(at(g, 4200 + 2400, 4200), 0);
});

test("fade returns a scaled copy and leaves the input alone", () => {
  const g = emptyGrid(MAP);
  stamp(g, 4200, 4200, 10, 1000);
  const f = fade(g, 0.5);
  assert.equal(at(f, 4200, 4200), 5);
  assert.equal(at(g, 4200, 4200), 10);
});

for (const [name, g] of [["deployed artillery", ghost("artillery", "sieged", 8200, 8200)], ["tank", ghost("tank", "mobile", 8200, 8200)]] as const) {
  test(`liveDanger: a ${name} reaches as far as on the threat map`, () => {
    const live = liveDanger([g], MAP);
    const threat = buildThreat([g], MAP);
    const reach = reachOf(g);
    assert.equal(reach, g.kind === "artillery" ? UNIT_STATS.artillery.siegeRange : UNIT_STATS.tank.range + 400);
    assert.ok(Math.abs(at(live, g.x, g.y) - threatAt(threat, g)) < 1e-9);
    const inside = { x: g.x + reach * 0.8, y: g.y };
    const outside = { x: g.x + reach + 400, y: g.y };
    assert.ok(at(live, inside.x, inside.y) > 0 && threatAt(threat, inside) > 0);
    assert.equal(at(live, outside.x, outside.y), 0);
    assert.equal(threatAt(threat, outside), 0);
  });
}

test("scar: each layer halves after its half-life", () => {
  const s = emptyScar(MAP);
  for (const g of [s.sight, s.damage, s.loss]) stamp(g, 4200, 4200, 8, 1000);
  const a = updateScar(s, inputs(), HALF, HALF.sightHalfLife);
  assert.ok(Math.abs(at(a.sight, 4200, 4200) - 4) < 1e-9);
  const b = updateScar(s, inputs(), HALF, HALF.lossHalfLife);
  assert.ok(Math.abs(at(b.damage, 4200, 4200) - 2) < 1e-9);
  assert.ok(Math.abs(at(b.loss, 4200, 4200) - 4) < 1e-9);
});

test("scar: a forgotten armed ghost leaves half its power as sight scar", () => {
  const g = ghost("tank", "mobile", 4200, 4200);
  const s = updateScar(emptyScar(MAP), inputs({ forgotten: [g] }), HALF, 0);
  assert.ok(Math.abs(at(s.sight, 4200, 4200) - 0.5 * ghostPower(g)) < 1e-9);
  assert.equal(at(s.damage, 4200, 4200), 0);
});

test("scar: a hurt with no seen shooter adds damage scar out to 2200", () => {
  const s = updateScar(emptyScar(MAP), inputs({ hurts: [hurt(4200, 4200)] }), HALF, 0);
  assert.ok(at(s.damage, 4200, 4200) > 0);
  assert.ok(at(s.damage, 4200 + 2000, 4200) > 0);
  assert.equal(at(s.damage, 4200 + 2400, 4200), 0);
  assert.equal(at(s.sight, 4200, 4200), 0);
});

test("scar: a hurt within a known armed ghost's reach adds nothing", () => {
  const s = updateScar(emptyScar(MAP), inputs({ hurts: [hurt(4200, 4200)], known: [ghost("tank", "mobile", 4500, 4200)] }), HALF, 0);
  assert.ok(s.damage.values.every((v) => v === 0));
});

test("scar: a loss adds loss scar", () => {
  const s = updateScar(emptyScar(MAP), inputs({ losses: [{ id: 1, kind: "tank", x: 4200, y: 4200, rate: 0, tick: 0 }] }), HALF, 0);
  assert.ok(at(s.loss, 4200, 4200) > 0);
});

test("scar: own sight with no live danger clears only the sight layer", () => {
  const s = emptyScar(MAP);
  for (const g of [s.sight, s.damage, s.loss]) stamp(g, 4200, 4200, 8, 1000);
  const out = updateScar(s, inputs({ eyes: [{ x: 4200, y: 4200, sight: 800 }] }), HALF, 0);
  assert.equal(at(out.sight, 4200, 4200), 0);
  assert.equal(at(out.damage, 4200, 4200), 8);
  assert.equal(at(out.loss, 4200, 4200), 8);
});

test("scar: own sight keeps sight scar where live danger stands", () => {
  const s = emptyScar(MAP);
  stamp(s.sight, 4200, 4200, 8, 1000);
  const live = liveDanger([ghost("tank", "mobile", 4200, 4200)], MAP);
  const out = updateScar(s, inputs({ eyes: [{ x: 4200, y: 4200, sight: 800 }], live }), HALF, 0);
  assert.equal(at(out.sight, 4200, 4200), 8);
});

test("queries sum the layers, take the worst along a line, and pick the safest cell", () => {
  const scar = emptyScar(MAP);
  stamp(scar.loss, 8200, 8200, 5, 1000);
  const live = emptyGrid(MAP);
  stamp(live, 8200, 8200, 3, 1000);
  const d = { live, scar };
  assert.equal(dangerAt(d, 8200, 8200), 8);
  assert.equal(dangerAlong(d, { x: 6000, y: 8200 }, { x: 10400, y: 8200 }), 8);
  assert.equal(dangerAlong(d, { x: 6000, y: 2000 }, { x: 10400, y: 2000 }), 0);
  const best = safestNear(d, MAP, { x: 8200, y: 8200 }, 2000, () => 0)!;
  assert.equal(dangerAt(d, best.x, best.y), 0);
  assert.equal(safestNear(d, MAP, { x: 50000, y: 50000 }, 100, () => 0), null);
});
