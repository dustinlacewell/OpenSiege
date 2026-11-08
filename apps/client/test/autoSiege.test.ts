import assert from "node:assert/strict";
import { test } from "node:test";
import type { Intent, Unit, World } from "@mf/sim";
import { AutoSiege, IDLE_SIEGE_TICKS } from "../src/game/autoSiege.ts";

const unit = (id: number, over: Partial<Unit> = {}): Unit => ({ id, owner: 0, kind: "tank", mode: "mobile", orders: [], ...over }) as Unit;
const worldAt = (tick: number, units: Unit[]): World => ({ tick, units }) as unknown as World;

function setup() {
  const sent: Intent[] = [];
  return { sent, auto: new AutoSiege((i) => sent.push(i)) };
}

test("an own unit idle for 15 seconds gets one siege intent", () => {
  const { sent, auto } = setup();
  const u = unit(1);
  auto.update(worldAt(0, [u]), 0, true);
  auto.update(worldAt(IDLE_SIEGE_TICKS - 1, [u]), 0, true);
  assert.equal(sent.length, 0);
  auto.update(worldAt(IDLE_SIEGE_TICKS, [u]), 0, true);
  assert.deepEqual(sent, [{ t: "siege", units: [1], on: true, queue: false }]);
});

test("the delay comes from the getter and a change applies at once", () => {
  const sent: Intent[] = [];
  let delay = 100;
  const auto = new AutoSiege((i) => sent.push(i), () => delay);
  const u = unit(1);
  auto.update(worldAt(0, [u]), 0, true);
  auto.update(worldAt(50, [u]), 0, true);
  assert.equal(sent.length, 0);
  delay = 40;
  auto.update(worldAt(50, [u]), 0, true);
  assert.equal(sent.length, 1);
});

test("an order, a mode change or another owner restarts or skips the count", () => {
  const { sent, auto } = setup();
  const busy = unit(1);
  auto.update(worldAt(0, [busy, unit(2, { owner: 1 }), unit(3, { mode: "sieged" })]), 0, true);
  busy.orders = [{ type: "stop" } as never];
  auto.update(worldAt(100, [busy]), 0, true);
  busy.orders = [];
  auto.update(worldAt(IDLE_SIEGE_TICKS, [busy]), 0, true);
  assert.equal(sent.length, 0);
});

test("nothing goes out when inactive, and the clock restarts afterwards", () => {
  const { sent, auto } = setup();
  const u = unit(1);
  auto.update(worldAt(0, [u]), 0, true);
  auto.update(worldAt(IDLE_SIEGE_TICKS, [u]), 0, false);
  auto.update(worldAt(IDLE_SIEGE_TICKS + 1, [u]), 0, true);
  assert.equal(sent.length, 0);
});
