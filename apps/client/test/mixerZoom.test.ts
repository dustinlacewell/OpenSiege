import assert from "node:assert/strict";
import { test } from "node:test";
import type { SoundEvent } from "../src/audio/cues.ts";
import { DEFAULT_TUNING } from "../src/audio/defaultTuning.ts";
import { createCamera } from "../src/game/camera.ts";
import { listenerOf, mixEvents, zoomFactor, type Listener } from "../src/audio/mixer.ts";
import type { GlobalTuning } from "../src/audio/soundTuning.ts";

// Default: zoomFloor 0.15, zoomNear 1500, zoomFar 12000, hearingRange 0.9, mergeBoost 0.25, maxGain 1.6.
const G = DEFAULT_TUNING.global;
const withG = (over: Partial<GlobalTuning>): GlobalTuning => ({ ...G, ...over });
const all = () => true;

function ear(zoom: number): Listener {
  return { x: 0, y: 0, rightX: 1, rightY: 0, radius: 1000, halfWidth: 600, zoom };
}

function event(over: Partial<SoundEvent>): SoundEvent {
  return { cue: "shellGround", x: 0, y: 0, spatial: true, own: true, size: 0.5, ...over };
}

test("zoomFactor is 1 near, the floor far, and clamps outside", () => {
  assert.equal(zoomFactor(600, G), 1);
  assert.equal(zoomFactor(1500, G), 1);
  assert.equal(zoomFactor(12000, G), 0.15);
  assert.equal(zoomFactor(14000, G), 0.15);
});

test("zoomFactor is linear between near and far", () => {
  const mid = (1500 + 12000) / 2;
  assert.ok(Math.abs(zoomFactor(mid, G) - (1 + 0.15) / 2) < 1e-9);
});

test("listenerOf takes range and zoom from the tuning", () => {
  const cam = createCamera(800, 600);
  cam.dist = 6000;
  const l = listenerOf(cam, withG({ hearingRange: 1.5 }));
  assert.equal(l.radius, 9000);
  assert.equal(l.zoom, zoomFactor(6000, G));
});

test("a placed sound is scaled by the zoom factor", () => {
  const [full] = mixEvents([event({})], ear(1), all, G);
  const [far] = mixEvents([event({})], ear(0.5), all, G);
  assert.equal(full!.gain, 1);
  assert.equal(far!.gain, 0.5);
});

test("a sound with no place is not scaled", () => {
  const [v] = mixEvents([event({ cue: "underAttack", spatial: false })], ear(0.15), all, G);
  assert.equal(v!.gain, 1);
});

test("merge boost and max gain come from the tuning", () => {
  const four = [event({}), event({}), event({}), event({})];
  const [base] = mixEvents(four, ear(1), all, withG({ mergeBoost: 0 }));
  assert.equal(base!.gain, 1);
  const [boosted] = mixEvents(four, ear(1), all, withG({ mergeBoost: 0.25, maxGain: 4 }));
  assert.equal(boosted!.gain, 1.5);
  const [capped] = mixEvents(four, ear(1), all, withG({ mergeBoost: 0.25, maxGain: 1.2 }));
  assert.equal(capped!.gain, 1.2);
});
