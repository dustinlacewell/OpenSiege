import { test } from "node:test";
import assert from "node:assert/strict";
import type { EngineStats } from "../src/audio/audioEngine.ts";
import type { SoundEvent } from "../src/audio/cues.ts";
import { DEFAULT_TUNING } from "../src/audio/defaultTuning.ts";
import { zoomFactor } from "../src/audio/mixer.ts";
import {
  NO_DROPS, STEP_MS, bucketByStep, cameraRange, draftToTuning, listenerAt, readout, scenarios, singleSound, type ScheduledSound,
} from "../src/dev/soundEditor/auditionModel.ts";
import { GLOBAL_COLUMN, tuningToTable } from "../src/dev/soundEditor/soundTable.ts";

// The audition panel's pure part: the stress scenarios, their grouping into steps, the draft to tuning rule, the readout.

const REACH = 1000;
const G = DEFAULT_TUNING.global;
const byId = (id: string) => scenarios(REACH).find((s) => s.id === id)!.sounds;
const events = (sounds: readonly ScheduledSound[]): SoundEvent[] => sounds.flatMap((s) => ("event" in s ? [s.event] : []));
const count = (sounds: readonly ScheduledSound[], cue: string) => events(sounds).filter((e) => e.cue === cue).length;
const times = (sounds: readonly ScheduledSound[]) => sounds.map((s) => s.atMs);
const sorted = (xs: readonly number[]) => xs.every((x, i) => i === 0 || xs[i - 1]! <= x);

test("the four scenarios are listed in order with labels", () => {
  assert.deepEqual(scenarios(REACH).map((s) => [s.id, s.label]), [
    ["shots", "50 shots in 1 s"],
    ["order", "30-unit order"],
    ["fight", "big fight"],
    ["alert", "alert under load"],
  ]);
});

test("50 shots in 1 s: 50 spread direct shots inside one second, in time order", () => {
  const s = byId("shots");
  assert.equal(s.length, 50);
  assert.equal(count(s, "shotDirect"), 50);
  assert.ok(sorted(times(s)) && Math.max(...times(s)) < 1000);
  assert.ok(events(s).every((e) => e.spatial && Math.hypot(e.x, e.y) <= REACH));
  assert.ok(new Set(events(s).map((e) => `${e.x.toFixed(3)},${e.y.toFixed(3)}`)).size > 45);
});

test("30-unit order: 30 interface acks inside 0.3 s", () => {
  const s = byId("order");
  assert.equal(s.length, 30);
  assert.ok(s.every((x) => "ui" in x && x.ui === "ack"));
  assert.ok(sorted(times(s)) && Math.max(...times(s)) < 300);
});

test("big fight: 60 ballistic shots, 40 impacts, 10 destroyed over 3 s, and an alert at 1.5 s", () => {
  const s = byId("fight");
  assert.equal(count(s, "shotBallistic"), 60);
  assert.equal(count(s, "shellGround"), 40);
  assert.equal(count(s, "destroyed"), 10);
  assert.equal(s.length, 111);
  assert.ok(sorted(times(s)) && Math.max(...times(s)) < 3000);
  const alerts = s.filter((x) => "event" in x && x.event.cue === "underAttack");
  assert.deepEqual(alerts.map((a) => [a.atMs, "event" in a && a.event.spatial]), [[1500, false]]);
});

test("alert under load: 200 shots in 1 s and an alert at 0.5 s", () => {
  const s = byId("alert");
  assert.equal(count(s, "shotDirect"), 200);
  assert.ok(sorted(times(s)) && Math.max(...times(s)) < 1000);
  const alert = s.find((x) => "event" in x && x.event.cue === "underAttack")!;
  assert.equal(alert.atMs, 500);
  assert.equal(s.length, 201);
});

test("sounds are grouped by 50 ms step, in time order", () => {
  const steps = bucketByStep(byId("shots"));
  assert.equal(steps.length, 1000 / STEP_MS);
  assert.deepEqual(steps.map((s) => s.atMs), Array.from({ length: 20 }, (_, i) => i * STEP_MS));
  assert.equal(steps.reduce((n, s) => n + s.events.length, 0), 50);
  assert.ok(steps.every((s) => s.ui.length === 0));
});

test("the 30-unit order lands in a few steps, with the interface cues kept apart from world events", () => {
  const steps = bucketByStep(byId("order"));
  assert.equal(steps.length, 300 / STEP_MS);
  assert.equal(steps.reduce((n, s) => n + s.ui.length, 0), 30);
  assert.ok(steps.every((s) => s.events.length === 0));
});

test("the alert is in its own step of the fight, with the shots of that step", () => {
  const step = bucketByStep(byId("fight")).find((s) => s.atMs === 1500)!;
  assert.ok(step.events.some((e) => e.cue === "underAttack"));
  assert.ok(step.events.length > 1);
});

test("a step is any width", () => {
  const steps = bucketByStep([{ atMs: 5, ui: "ack" }, { atMs: 95, ui: "select" }, { atMs: 120, ui: "ack" }], 100);
  assert.deepEqual(steps.map((s) => [s.atMs, s.ui]), [[0, ["ack", "select"]], [100, ["ack"]]]);
});

test("one cue once: interface cues go to the interface, centred world cues are not placed, the rest are", () => {
  assert.deepEqual(singleSound("ack"), { atMs: 0, ui: "ack" });
  const centred = singleSound("underAttack");
  assert.ok("event" in centred && !centred.event.spatial);
  const placed = singleSound("shotDirect");
  assert.ok("event" in placed && placed.event.spatial && placed.event.own);
});

test("a draft with a legal tuning becomes the tuning", () => {
  const table = tuningToTable(DEFAULT_TUNING);
  const draft = { ...table, [GLOBAL_COLUMN]: { ...table[GLOBAL_COLUMN]!, masterGain: 0.25 } };
  const next = draftToTuning(draft, DEFAULT_TUNING);
  assert.equal(next.global.masterGain, 0.25);
  assert.notEqual(next, DEFAULT_TUNING);
});

test("a draft with an invalid cell keeps the last good tuning", () => {
  const table = tuningToTable(DEFAULT_TUNING);
  const outOfRange = { ...table, ack: { ...table.ack!, rank: 5000 } };
  assert.equal(draftToTuning(outOfRange, DEFAULT_TUNING), DEFAULT_TUNING);
  const crossRule = { ...table, [GLOBAL_COLUMN]: { ...table[GLOBAL_COLUMN]!, reservedSlots: G.voiceCap } };
  assert.equal(draftToTuning(crossRule, DEFAULT_TUNING), DEFAULT_TUNING);
  const { [GLOBAL_COLUMN]: _gone, ...noGlobal } = table;
  assert.equal(draftToTuning(noGlobal, DEFAULT_TUNING), DEFAULT_TUNING);
});

test("the camera slider spans the zoom range, and the listener takes range and zoom from the tuning", () => {
  assert.deepEqual(cameraRange(G), { min: G.zoomNear, max: G.zoomFar });
  const l = listenerAt(3000, G);
  assert.equal(l.radius, 3000 * G.hearingRange);
  assert.equal(l.zoom, zoomFactor(3000, G));
});

test("the readout counts drops since the reset and lists the active cues in cue order", () => {
  const stats: EngineStats = { total: 5, byCue: { shellGround: 2, shotDirect: 3, ack: 0 }, dropped: { cueFull: 10, capFull: 4, reserved: 1, busy: 6 } };
  assert.deepEqual(readout(stats, NO_DROPS, 24), {
    playing: 5,
    cap: 24,
    active: [{ cue: "shotDirect", count: 3 }, { cue: "shellGround", count: 2 }],
    drops: { cueFull: 10, capFull: 4, reserved: 1, busy: 6 },
  });
  assert.deepEqual(readout(stats, { cueFull: 10, capFull: 1, reserved: 1, busy: 2 }, 24).drops, { cueFull: 0, capFull: 3, reserved: 0, busy: 4 });
});
