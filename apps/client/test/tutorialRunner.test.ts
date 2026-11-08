import { test } from "node:test";
import assert from "node:assert/strict";
import type { Intent, Unit, UnitKind, World } from "@mf/sim";
import { GuideSlot, NO_GUIDE, TutorialGuide } from "../src/game/tutorial/guide.ts";
import { acknowledge, advance, currentStep, finished, guideView, isPaused, noteSent, startTutorial } from "../src/game/tutorial/runner.ts";
import { rule, type Lesson, type NoteStep, type Policy, type Step, type TaskStep } from "../src/game/tutorial/types.ts";

function world(...units: { id: number; owner: number; kind: UnitKind }[]): World {
  return { units: units as Unit[] } as unknown as World;
}

const w = world({ id: 1, owner: 1, kind: "tank" }, { id: 2, owner: 1, kind: "engineer" });
const cam = { x: 0, y: 0, yaw: 0 };
const view = { world: w, me: 1, selected: [] as number[], camera: cam };
/** A fresh state that has seen its first view. */
const begun = () => ({ ...startTutorial(), cameraStart: cam });
const stop: Intent = { t: "stop", units: [1] };
const move: Intent = { t: "move", units: [1], x: 0, y: 0, force: false, queue: false, attack: false };
const all = () => true;
const FREE_ALL: Policy = { intents: [rule("stop"), rule("move")], selectable: all, commandable: all };

function step(
  id: string, done: TaskStep["done"], policy: Policy = { intents: [rule("stop")], selectable: all, commandable: all }, zones: string[] = [],
): TaskStep {
  return { t: "task", id, prompt: `do ${id}`, policy, focus: { controls: [{ t: "cmd", name: "stop" }], units: () => [1], zones }, done };
}

function note(id: string): NoteStep {
  return { t: "note", id, prompt: `read ${id}`, focus: { controls: [], units: () => [], zones: [] } };
}

const sentStop: TaskStep["done"] = (obs) => obs.sent.some((i) => i.t === "stop");

function lesson(...steps: Step[]): Lesson {
  return { zones: [{ name: "base", x: 10, y: 20, radius: 30 }], steps };
}

test("tutorial runner: advances one step when done holds", () => {
  const l = lesson(step("a", () => true), step("b", () => true));
  const s = advance(l, startTutorial(), view);
  assert.equal(s.index, 1);
  assert.equal(currentStep(l, s)?.id, "b");
});

test("tutorial runner: stays when done does not hold", () => {
  const l = lesson(step("a", () => false));
  const s0 = begun();
  assert.equal(advance(l, s0, view), s0);
});

test("tutorial runner: the first view sets cameraStart; a new step starts from the camera that ended the last", () => {
  const moved = (obs: { camera: { x: number }; cameraStart: { x: number } }) => obs.camera.x - obs.cameraStart.x >= 10;
  const l = lesson(step("a", moved), step("b", moved));
  const s0 = advance(l, startTutorial(), view);
  assert.deepEqual(s0.cameraStart, cam);
  assert.equal(advance(l, s0, view), s0);
  const there = { ...view, camera: { x: 10, y: 0, yaw: 0 } };
  const s1 = advance(l, s0, there);
  assert.equal(s1.index, 1);
  assert.deepEqual(s1.cameraStart, there.camera);
  assert.equal(advance(l, s1, there).index, 1);
});

test("tutorial runner: sent accumulates, done sees it, and it clears on advance", () => {
  const l = lesson(step("a", sentStop), step("b", () => false));
  const s1 = noteSent(begun(), move);
  assert.deepEqual(s1.sent, [move]);
  assert.equal(advance(l, s1, view).index, 0);
  const s2 = noteSent(s1, stop);
  assert.deepEqual(s2.sent, [move, stop]);
  assert.deepEqual(s1.sent, [move]);
  const s3 = advance(l, s2, view);
  assert.deepEqual(s3, { index: 1, sent: [], acknowledged: false, cameraStart: cam });
});

test("tutorial runner: a note is done once acknowledged, and the flag clears on advance", () => {
  const l = lesson(note("n"), note("m"));
  const s0 = begun();
  assert.equal(advance(l, s0, view), s0);
  const s1 = acknowledge(s0);
  assert.equal(s0.acknowledged, false);
  assert.deepEqual(advance(l, s1, view), { index: 1, sent: [], acknowledged: false, cameraStart: cam });
});

test("tutorial runner: a task ignores acknowledge", () => {
  const l = lesson(step("a", () => false));
  const s = acknowledge(begun());
  assert.equal(advance(l, s, view), s);
});

test("tutorial runner: a finished lesson stays put and has no view", () => {
  const l = lesson(step("a", () => true));
  const done = advance(l, begun(), view);
  assert.equal(finished(l, done), true);
  assert.equal(currentStep(l, done), null);
  assert.equal(advance(l, done, view), done);
  assert.equal(guideView(l, done, w, 1), null);
});

test("tutorial runner: a freeze task stops time until its first intent; a plain task never does", () => {
  const frozen = lesson({ ...step("f", () => false), freeze: true });
  assert.equal(isPaused(frozen, startTutorial()), true);
  assert.equal(isPaused(frozen, noteSent(startTutorial(), { t: "stop", units: [1] } as Intent)), false);
  assert.equal(isPaused(lesson(step("p", () => false)), startTutorial()), false);
});

test("tutorial runner: guideView resolves zones and focus", () => {
  const l = lesson(step("a", () => false, undefined, ["base"]), note("n"));
  assert.deepEqual(guideView(l, startTutorial(), w, 1), {
    prompt: "do a", index: 0, count: 2, note: false,
    controls: [{ t: "cmd", name: "stop" }], units: [1], zones: [{ name: "base", x: 10, y: 20, radius: 30 }],
    gesture: null, follow: [],
  });
  assert.equal(guideView(l, { index: 1, sent: [], acknowledged: false, cameraStart: null }, w, 1)?.note, true);
});

test("tutorial runner: an unknown zone name throws", () => {
  const l = lesson(step("a", () => false, undefined, ["nowhere"]));
  assert.throws(() => guideView(l, startTutorial(), w, 1), /nowhere/);
});

test("tutorial guide: gates by the current step, free when finished", () => {
  const tanksOnly: Policy = { intents: [rule("stop")], selectable: (u) => u.kind === "tank", commandable: all };
  const l = lesson(step("a", sentStop, tanksOnly), step("b", () => false, { intents: [rule("move")], selectable: all, commandable: all }));
  const g = new TutorialGuide(l, () => view);
  assert.equal(g.admit(stop), stop);
  assert.equal(g.admit(move), null);
  assert.equal(g.mayIssue("guard"), false);
  assert.deepEqual(g.selectable([2, 1]), [1]);
  assert.equal(g.paused(), false);
  g.update();
  assert.equal(g.view()?.index, 0);
  g.noteSent(stop);
  g.update();
  assert.equal(g.view()?.index, 1);
  assert.equal(g.admit(move), move);
  assert.equal(g.admit(stop), null);

  const free = new TutorialGuide(lesson(step("a", () => true)), () => view);
  free.update();
  assert.equal(free.view(), null);
  assert.equal(free.stepIndex(), null);
  assert.equal(free.admit(move), move);
  assert.equal(free.mayIssue("guard"), true);
  assert.deepEqual(free.selectable([2, 9]), [2, 9]);
});

test("tutorial guide: admit takes a non-commandable unit out", () => {
  const p: Policy = { intents: [rule("move")], selectable: all, commandable: (u) => u.kind === "tank" };
  const g = new TutorialGuide(lesson(step("a", () => false, p)), () => view);
  assert.deepEqual(g.admit({ ...move, units: [2, 1] }), move);
});

test("tutorial guide: a note pauses, blocks everything, and acknowledge advances", () => {
  const l = lesson(note("n"), step("b", () => false, FREE_ALL));
  const g = new TutorialGuide(l, () => view);
  assert.equal(g.paused(), true);
  assert.equal(g.view()?.note, true);
  assert.equal(g.admit(stop), null);
  assert.equal(g.mayIssue("stop"), false);
  assert.deepEqual(g.selectable([1]), []);
  g.update();
  assert.equal(g.stepIndex(), 0);
  g.acknowledge();
  g.update();
  assert.equal(g.stepIndex(), 1);
  assert.equal(g.paused(), false);
  assert.equal(g.admit(stop), stop);
});

test("tutorial guide: acknowledge on a task does nothing", () => {
  const l = lesson(step("a", () => false), note("n"));
  const g = new TutorialGuide(l, () => view);
  g.acknowledge();
  g.update();
  assert.equal(g.stepIndex(), 0);
});

test("tutorial guide: no world means no view and no advance", () => {
  const g = new TutorialGuide(lesson(step("a", () => true)), () => null);
  g.update();
  assert.equal(g.view(), null);
  assert.equal(g.admit(stop), null);
  assert.deepEqual(g.selectable([1]), []);
});

test("tutorial guide: NO_GUIDE admits everything unchanged and shows nothing", () => {
  assert.equal(NO_GUIDE.admit(move), move);
  assert.equal(NO_GUIDE.mayIssue("quota"), true);
  assert.equal(NO_GUIDE.paused(), false);
  NO_GUIDE.acknowledge();
  const ids = [3, 1];
  const out = NO_GUIDE.selectable(ids);
  assert.deepEqual(out, ids);
  assert.notEqual(out, ids);
  NO_GUIDE.noteSent(stop);
  assert.equal(NO_GUIDE.view(), null);
});

test("guide slot: starts as NO_GUIDE", () => {
  const slot = new GuideSlot();
  assert.equal(slot.admit(move), move);
  assert.equal(slot.mayIssue("guard"), true);
  assert.equal(slot.paused(), false);
  assert.deepEqual(slot.selectable([1, 2]), [1, 2]);
  slot.update();
  assert.equal(slot.view(), null);
});

test("guide slot: delegates every call to the set guide, and back to NO_GUIDE", () => {
  const slot = new GuideSlot();
  slot.set(new TutorialGuide(lesson(step("a", sentStop), note("b"), step("c", () => false)), () => view));
  assert.equal(slot.admit(stop), stop);
  assert.equal(slot.admit(move), null);
  assert.equal(slot.mayIssue("move"), false);
  assert.deepEqual(slot.selectable([1, 2]), [1, 2]);
  assert.equal(slot.view()?.prompt, "do a");
  slot.noteSent(stop);
  slot.update();
  assert.equal(slot.view()?.prompt, "read b");
  assert.equal(slot.paused(), true);
  slot.acknowledge();
  slot.update();
  assert.equal(slot.view()?.prompt, "do c");
  slot.set(NO_GUIDE);
  assert.equal(slot.admit(move), move);
  assert.equal(slot.paused(), false);
  assert.equal(slot.view(), null);
});
