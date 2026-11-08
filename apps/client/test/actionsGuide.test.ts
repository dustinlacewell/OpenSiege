import assert from "node:assert/strict";
import { test } from "node:test";
import type { Intent, Unit } from "@mf/sim";
import type { Camera } from "../src/game/camera.ts";
import { hotkeyFor } from "../src/game/hotkeys.ts";
import type { Session } from "../src/game/session.ts";
import { NO_GUIDE, type Guide } from "../src/game/tutorial/guide.ts";
import type { Vision } from "../src/game/vision.ts";
import { actionContext, type ActionContext } from "../src/input/actions/context.ts";
import { guideActions } from "../src/input/actions/guide.ts";
import { hotkeyActions } from "../src/input/actions/hotkey.ts";
import { selectActions } from "../src/input/actions/select.ts";
import { targetActions } from "../src/input/actions/target.ts";

/** A guide that allows only the listed intent types and ids. Records what it was told was sent. */
function fakeGuide(allowTypes: readonly Intent["t"][], allowIds: readonly number[], paused = false): Guide & { noted: Intent[] } {
  const noted: Intent[] = [];
  return {
    ...NO_GUIDE,
    noted,
    admit: (i) => (allowTypes.includes(i.t) ? i : null),
    mayIssue: (t) => allowTypes.includes(t),
    selectable: (ids) => ids.filter((id) => allowIds.includes(id)),
    paused: () => paused,
    holdsSelection: () => paused,
    noteSent: (i) => void noted.push(i),
  };
}

const unit = (id: number): Unit => ({ id, owner: 1, kind: "tank", x: 0, y: 0 }) as Unit;

function fakeSession(selected: number[]): Session {
  const s = {
    me: 1,
    world: { units: [unit(1), unit(2), unit(3)], players: [], features: [] },
    selected,
    get selectedSet() { return new Set(s.selected); },
    boxPreview: new Set<number>(),
    groups: [] as number[][],
    lastRecall: null,
    targetMode: null,
    select(ids: readonly number[]) { s.selected = [...ids]; },
    clearBox() { s.boxPreview = new Set(); },
  };
  return s as unknown as Session;
}

function setup(guide: Guide, selected: number[] = []) {
  const session = fakeSession(selected);
  const sent: Intent[] = [];
  const base = actionContext(session, {} as Camera, {} as Vision, (i) => sent.push(i), guide);
  const ctx: ActionContext = { ...base, pickAt: (_sx, _sy, accept) => [unit(2)].find(accept) };
  return { session, sent, ctx };
}

const stop: Intent = { t: "stop", units: [1] } as Intent;

test("a blocked intent is not sent and not noted", () => {
  const guide = fakeGuide([], []);
  const { sent, ctx } = setup(guide);
  ctx.emit(stop);
  ctx.send(stop);
  assert.equal(sent.length, 0);
  assert.equal(guide.noted.length, 0);
});

test("an allowed intent is sent, then noted", () => {
  const guide = fakeGuide(["stop"], []);
  const order: string[] = [];
  const session = fakeSession([]);
  const ctx = actionContext(session, {} as Camera, {} as Vision, () => order.push(`sent ${guide.noted.length}`), guide);
  ctx.emit(stop);
  assert.deepEqual(order, ["sent 0"]);
  assert.deepEqual(guide.noted, [stop]);
});

test("the admitted intent is what is sent and noted", () => {
  const narrowed: Intent = { t: "stop", units: [2] };
  const guide = { ...fakeGuide(["stop"], []), admit: () => narrowed };
  const noted: Intent[] = [];
  const sent: Intent[] = [];
  const ctx = actionContext(fakeSession([]), {} as Camera, {} as Vision, (i) => sent.push(i), { ...guide, noteSent: (i) => void noted.push(i) });
  ctx.send({ t: "stop", units: [1, 2] });
  assert.deepEqual(sent, [narrowed]);
  assert.deepEqual(noted, [narrowed]);
});

test("a frozen step (paused, selection free) still selects", () => {
  const { session, ctx } = setup({ ...fakeGuide([], [1, 2, 3], true), holdsSelection: () => false }, [1]);
  ctx.select([2], false);
  assert.deepEqual(session.selected, [2]);
});

test("a guide that holds the selection keeps it: no select, no clear, no deselect", () => {
  const { session, ctx } = setup(fakeGuide([], [1, 2, 3], true), [1]);
  ctx.select([2], false);
  ctx.select([], false);
  selectActions(ctx).deselect(1);
  assert.deepEqual(session.selected, [1]);
});

test("Enter acknowledges through the guide", () => {
  let acks = 0;
  const { ctx } = setup({ ...fakeGuide([], []), acknowledge: () => void acks++ });
  const to = { ...selectActions(ctx), ...targetActions(ctx), ...guideActions(ctx) } as never;
  const key = hotkeyFor("Enter", { ctrl: false, alt: false, shift: false });
  assert.deepEqual(key, { t: "continue" });
  hotkeyActions(ctx, to, () => {}, () => false).hotkey(key!, false, 0);
  assert.equal(acks, 1);
});

test("box select keeps only selectable ids", () => {
  const { session, ctx } = setup(fakeGuide([], [1, 3]));
  session.boxPreview = new Set([1, 2, 3]);
  selectActions(ctx).boxSelect(false);
  assert.deepEqual(session.selected, [1, 3]);
});

test("click select on a blocked unit selects nothing", () => {
  const { session, ctx } = setup(fakeGuide([], [1]));
  selectActions(ctx).clickSelect(0, 0, false);
  assert.deepEqual(session.selected, []);
});

test("click select on a blocked unit keeps the current selection", () => {
  const { session, ctx } = setup(fakeGuide([], [1]), [1]);
  selectActions(ctx).clickSelect(0, 0, false);
  assert.deepEqual(session.selected, [1]);
});

test("box select of only blocked units keeps the current selection", () => {
  const { session, ctx } = setup(fakeGuide([], [1]), [1]);
  session.boxPreview = new Set([2, 3]);
  selectActions(ctx).boxSelect(false);
  assert.deepEqual(session.selected, [1]);
});

test("an empty hit still clears the selection under a guide", () => {
  const { session, ctx } = setup(fakeGuide([], [1]), [1]);
  ctx.select([], false);
  assert.deepEqual(session.selected, []);
});

test("click select on an allowed unit selects it", () => {
  const { session, ctx } = setup(fakeGuide([], [2]));
  selectActions(ctx).clickSelect(0, 0, false);
  assert.deepEqual(session.selected, [2]);
});

test("deselect works when the guide blocks every selection", () => {
  const { session, ctx } = setup(fakeGuide([], []), [1, 2]);
  selectActions(ctx).deselect(1);
  assert.deepEqual(session.selected, [2]);
});

test("group recall selects only the allowed members", () => {
  const { session, ctx } = setup(fakeGuide([], [3]));
  session.groups = [[], [1, 3]];
  const to = { ...selectActions(ctx), ...targetActions(ctx) } as never;
  hotkeyActions(ctx, to, () => {}, () => false).hotkey({ t: "group", index: 1, op: "recall" }, false, 0);
  assert.deepEqual(session.selected, [3]);
});

test("enterTarget is blocked when the guide may not issue the intent", () => {
  const { session, ctx } = setup(fakeGuide(["guard"], []), [1]);
  const actions = targetActions(ctx);
  actions.enterTarget("attackMove");
  assert.equal(session.targetMode, null);
  actions.enterTarget("guard");
  assert.equal(session.targetMode, "guard");
});

test("NO_GUIDE is the default: everything is sent and selectable", () => {
  const session = fakeSession([]);
  const sent: Intent[] = [];
  const ctx = actionContext(session, {} as Camera, {} as Vision, (i) => sent.push(i));
  ctx.emit(stop);
  ctx.select([1, 2], false);
  assert.deepEqual(sent, [stop]);
  assert.deepEqual(session.selected, [1, 2]);
});
