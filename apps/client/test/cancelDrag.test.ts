import assert from "node:assert/strict";
import { test } from "node:test";
import type { ReclaimArea } from "../src/game/areaReclaim.ts";
import type { Curve } from "../src/game/curve.ts";
import type { Session } from "../src/game/session.ts";
import { commandActions } from "../src/input/actions/command.ts";
import type { ActionContext } from "../src/input/actions/context.ts";

function setup(curve: Curve | null, area: ReclaimArea | null) {
  const session = { curve, area } as unknown as Session;
  const ctx = { session, send: () => {}, emit: () => {} } as unknown as ActionContext;
  return { session, actions: commandActions(ctx) };
}

const curve = { path: [{ x: 1, y: 2 }] } as unknown as Curve;
const area: ReclaimArea = { x: 1, y: 2, radius: 3, press: 7 };

test("cancelDrag clears a curve and returns true", () => {
  const { session, actions } = setup(curve, null);
  assert.equal(actions.cancelDrag(), true);
  assert.equal(session.curve, null);
});

test("cancelDrag clears an area and returns true", () => {
  const { session, actions } = setup(null, area);
  assert.equal(actions.cancelDrag(), true);
  assert.equal(session.area, null);
});

test("cancelDrag with no drag returns false", () => {
  const { actions } = setup(null, null);
  assert.equal(actions.cancelDrag(), false);
});

test("each cancelDrag adds 1 to dragCancels", () => {
  const { actions } = setup(curve, area);
  assert.equal(actions.dragCancels(), 0);
  actions.cancelDrag();
  actions.cancelDrag();
  assert.equal(actions.dragCancels(), 2);
});
