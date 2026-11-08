import { test } from "node:test";
import assert from "node:assert/strict";
import type { Intent, Unit, UnitKind, World } from "@mf/sim";
import { FREE_POLICY, admit, allowedSelection, mayIssue, permits } from "../src/game/tutorial/policy.ts";
import { rule, type Policy } from "../src/game/tutorial/types.ts";

function world(...units: { id: number; owner: number; kind: UnitKind }[]): World {
  return { units: units as Unit[] } as unknown as World;
}

const move = (x: number, units: number[] = [1]): Intent => ({ t: "move", units, x, y: 0, force: false, queue: false, attack: false });
const w = world({ id: 1, owner: 1, kind: "tank" }, { id: 2, owner: 1, kind: "engineer" }, { id: 3, owner: 2, kind: "tank" }, { id: 4, owner: 1, kind: "factory" });
const all = () => true;
const notFactory = (u: Unit) => u.kind !== "factory";

test("tutorial policy: permits by tag", () => {
  const p: Policy = { intents: [rule("stop")], selectable: all, commandable: all };
  assert.equal(permits(p, { t: "stop", units: [1] }, w, 1), true);
  assert.equal(permits(p, move(5), w, 1), false);
});

test("tutorial policy: permits by where", () => {
  const p: Policy = { intents: [rule("move", (i) => i.x > 100)], selectable: all, commandable: all };
  assert.equal(permits(p, move(200), w, 1), true);
  assert.equal(permits(p, move(50), w, 1), false);
});

test("tutorial policy: where sees world and me", () => {
  const p: Policy = {
    intents: [rule("attack", (i, wd, me) => wd.units.some((u) => u.id === i.target && u.owner !== me))],
    selectable: all,
    commandable: all,
  };
  assert.equal(permits(p, { t: "attack", units: [1], target: 3, queue: false }, w, 1), true);
  assert.equal(permits(p, { t: "attack", units: [1], target: 2, queue: false }, w, 1), false);
});

test("tutorial policy: mayIssue is true only for listed tags", () => {
  const p: Policy = { intents: [rule("guard", () => false)], selectable: all, commandable: all };
  assert.equal(mayIssue(p, "guard"), true);
  assert.equal(mayIssue(p, "move"), false);
});

test("tutorial policy: allowedSelection drops non-selectable and missing ids, keeps order", () => {
  const p: Policy = { intents: [], selectable: (u, me) => u.owner === me && u.kind === "tank", commandable: all };
  assert.deepEqual(allowedSelection(p, w, 1, [9, 2, 1, 3]), [1]);
  const own: Policy = { intents: [], selectable: (u, me) => u.owner === me, commandable: all };
  assert.deepEqual(allowedSelection(own, w, 1, [2, 9, 1, 4]), [2, 1, 4]);
});

test("tutorial policy: admit takes a non-commandable factory out of a move", () => {
  const p: Policy = { intents: [rule("move")], selectable: all, commandable: notFactory };
  assert.deepEqual(admit(p, move(5, [4, 1, 2]), w, 1), move(5, [1, 2]));
  assert.deepEqual(admit(p, move(5, [1, 4]), w, 1), move(5, [1]));
});

test("tutorial policy: admit drops a unit order left with no units, and one with no rule", () => {
  const p: Policy = { intents: [rule("move"), rule("stop")], selectable: all, commandable: notFactory };
  assert.equal(admit(p, move(5, [4]), w, 1), null);
  assert.equal(admit(p, { t: "stop", units: [4] }, w, 1), null);
  assert.equal(admit(p, { t: "guard", units: [1], target: 2, queue: false }, w, 1), null);
});

test("tutorial policy: admit strips before the rules run, and keeps the object when nothing goes", () => {
  const onlyTanks: Policy = {
    intents: [rule("move", (i, wd) => i.units.every((id) => wd.units.find((u) => u.id === id)?.kind === "tank"))],
    selectable: all,
    commandable: (u) => u.kind === "tank",
  };
  assert.deepEqual(admit(onlyTanks, move(5, [2, 1]), w, 1), move(5, [1]));
  const m = move(5, [1]);
  assert.equal(admit(onlyTanks, m, w, 1), m);
  const p: Policy = { intents: [rule("move", (i) => i.x > 100)], selectable: all, commandable: all };
  assert.equal(admit(p, move(50), w, 1), null);
});

test("tutorial policy: admit never strips siege, so a factory siege passes", () => {
  const p: Policy = { intents: [rule("siege")], selectable: all, commandable: notFactory };
  const siege: Intent = { t: "siege", units: [4], on: true, queue: false };
  assert.equal(admit(p, siege, w, 1), siege);
});

test("tutorial policy: FREE_POLICY admits every tag unchanged and selects every unit", () => {
  const samples: Intent[] = [
    { t: "join", name: "a" },
    { t: "leave" },
    move(1, [1, 4]),
    { t: "attack", units: [1], target: 3, queue: false },
    { t: "stop", units: [1, 4] },
    { t: "siege", units: [1], on: true, queue: false },
    { t: "guard", units: [1, 4], target: 2, queue: false },
    { t: "reclaim", units: [2], target: 7, queue: false },
    { t: "build", factory: 4, kind: "tank" },
    { t: "cancel", factory: 4, jobs: [1] },
    { t: "rally", units: [4], x: 0, y: 0 },
    { t: "quota", factory: 4, kind: "tank", delta: 1 },
  ];
  for (const i of samples) assert.equal(admit(FREE_POLICY, i, w, 1), i, i.t);
  assert.deepEqual(allowedSelection(FREE_POLICY, w, 1, [3, 1, 2]), [3, 1, 2]);
});
