import { test } from "node:test";
import assert from "node:assert/strict";
import { createWorld, spawnUnit, type Intent, type World } from "@mf/sim";
import { NO_GUIDE } from "../src/game/tutorial/guide.ts";
import type { ControlId, GuideView } from "../src/game/tutorial/types.ts";
import { hudModel, type HudView } from "../src/ui/model.ts";

const ME = 1;

/** A small flat world: player 1 with credits, one factory (id 1) and one tank (id 2). */
function world(): World {
  const w = createWorld({ width: 1000, height: 1000, cell: 125, heights: new Array<number>(81).fill(0), rng: 1, fields: [], features: [] });
  w.players.push({ id: ME, name: "me", color: 1, credits: 10000, alive: true, connected: true, team: 0 });
  spawnUnit(w, ME, "factory", 200, 200);
  spawnUnit(w, ME, "tank", 400, 400);
  return w;
}

/** Admits only the listed tags. */
const only = (...tags: Intent["t"][]) => ({
  admit: (i: Intent) => (tags.includes(i.t) ? i : null),
  mayIssue: (t: Intent["t"]) => tags.includes(t),
});

function view(selected: number[], over: Partial<HudView> = {}): HudView {
  return { me: ME, self: ME, selected, page: 0, targetMode: null, groupOf: () => 0, guide: NO_GUIDE, guideView: null, ...over };
}

function guideView(controls: ControlId[], note = false): GuideView {
  return { prompt: "Build a tank", index: 1, count: 4, note, controls, units: [], zones: [] };
}

const slot = (m: ReturnType<typeof hudModel>, kind: string) => m.palette.find((s) => s.kind === kind)!;

test("hud guide: a build slot is locked when build is not permitted", () => {
  const m = hudModel(world(), view([1], { guide: only("stop") }));
  assert.equal(slot(m, "tank").enabled, true);
  assert.equal(slot(m, "tank").locked, true);
});

test("hud guide: no slot is locked with NO_GUIDE", () => {
  const m = hudModel(world(), view([1]));
  assert.ok(m.palette.every((s) => !s.locked && !s.focus));
});

test("hud guide: a slot is not locked without a selected factory", () => {
  const m = hudModel(world(), view([2], { guide: only() }));
  assert.ok(m.palette.every((s) => !s.locked));
});

test("hud guide: a build rule for one kind locks the other kinds", () => {
  const guide = { admit: (i: Intent) => (i.t === "build" && i.kind === "tank" ? i : null), mayIssue: () => true };
  const m = hudModel(world(), view([1], { guide }));
  assert.equal(slot(m, "tank").locked, false);
  assert.equal(slot(m, "engineer").locked, true);
});

test("hud guide: focus comes from the view's controls", () => {
  const m = hudModel(world(), view([1], { guideView: guideView([{ t: "slot", kind: "tank" }, { t: "cmd", name: "stop" }]) }));
  assert.equal(slot(m, "tank").focus, true);
  assert.equal(slot(m, "engineer").focus, false);
  assert.deepEqual(m.commands.stop, { locked: false, focus: true });
  assert.equal(m.commands.siege.focus, false);
});

test("hud guide: command locks follow the guide", () => {
  const none = hudModel(world(), view([2], { guide: only() }));
  assert.deepEqual(
    [none.commands.siege.locked, none.commands.stop.locked, none.commands.guard.locked, none.commands.attack.locked],
    [true, true, true, true],
  );
  const all = hudModel(world(), view([2], { guide: only("siege", "stop", "guard", "move") }));
  assert.deepEqual(
    [all.commands.siege.locked, all.commands.stop.locked, all.commands.guard.locked, all.commands.attack.locked],
    [false, false, false, false],
  );
});

test("hud guide: siege and stop are not locked with no intent to send", () => {
  const m = hudModel(world(), view([], { guide: only() }));
  assert.equal(m.commands.siege.locked, false);
  assert.equal(m.commands.stop.locked, false);
  assert.equal(m.commands.guard.locked, true);
});

test("hud guide: the prompt line is null with NO_GUIDE and filled with a view", () => {
  assert.equal(hudModel(world(), view([1])).guide, null);
  const m = hudModel(world(), view([1], { guideView: guideView([]) }));
  assert.deepEqual(m.guide, { prompt: "Build a tank", index: 1, count: 4, note: false });
});

test("hud guide: a note locks every slot, quota, command and the queue, even with NO_GUIDE answers", () => {
  const m = hudModel(world(), view([1, 2], { guideView: guideView([], true) }));
  assert.equal(m.guide?.note, true);
  assert.ok(m.palette.filter((s) => s.kind !== null).every((s) => s.locked && s.quotaLocked));
  assert.ok(Object.values(m.commands).every((c) => c.locked));
  assert.equal(m.queueLocked, true);
});

test("hud guide: queue cancel and slot quota lock when the guide may not issue them", () => {
  const locked = hudModel(world(), view([1], { guide: only("build") }));
  assert.equal(locked.queueLocked, true);
  assert.equal(slot(locked, "tank").quotaLocked, true);
  assert.equal(slot(locked, "tank").locked, false);
  const open = hudModel(world(), view([1], { guide: only("build", "cancel", "quota") }));
  assert.equal(open.queueLocked, false);
  assert.equal(slot(open, "tank").quotaLocked, false);
  const free = hudModel(world(), view([1]));
  assert.equal(free.queueLocked, false);
  assert.ok(free.palette.every((s) => !s.quotaLocked));
});
