import { test } from "node:test";
import assert from "node:assert/strict";
import type { World } from "@mf/sim";
import { leaders } from "../src/ui/leaderModel.ts";

const unit = (owner: number, kind: string) => ({ owner, kind });
const world = {
  players: [
    { id: 1, name: "ann", color: 1, credits: 600, connected: true },
    { id: 2, name: "bob", color: 2, credits: 75, connected: true },
    { id: 3, name: "gone", color: 3, credits: 0, connected: false },
  ],
  units: [
    unit(1, "factory"), unit(1, "harvester"), unit(1, "harvester"), unit(1, "tank"),
    unit(2, "factory"), unit(2, "factory"), unit(2, "artillery"), unit(2, "tank"), unit(2, "engineer"),
    unit(3, "tank"),
  ],
} as unknown as World;

test("leaders count factories, harvesters and armed-unit cost, strongest first, connected only", () => {
  const rows = leaders(world, 1);
  assert.deepEqual(rows.map((r) => r.name), ["bob", "ann"]);
  assert.deepEqual(rows.map((r) => [r.credits, r.factories, r.harvesters, r.power]), [[75, 2, 0, 650], [600, 1, 2, 250]]);
  assert.deepEqual(rows.map((r) => r.me), [false, true]);
});
