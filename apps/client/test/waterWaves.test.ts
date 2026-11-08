import { test } from "node:test";
import assert from "node:assert/strict";
import { crestSharpness, WAVE_GRAVITY, wavePhase, WAVES, wavesGlsl } from "../src/render/waterWaves.ts";

test("the wave set keeps crests from looping", () => {
  assert.ok(crestSharpness(WAVES) <= 1);
});

test("the waves are small: a few world units in sum", () => {
  const total = WAVES.reduce((s, w) => s + w.amplitude, 0);
  assert.ok(total > 1 && total < 8);
  assert.ok(WAVES.length >= 4 && WAVES.length <= 6);
});

test("wavePhase gives a unit direction, k = 2π/λ and deep-water ω = √(G·k)", () => {
  for (const w of WAVES) {
    const [dx, dy, k, omega] = wavePhase(w);
    assert.ok(Math.abs(Math.hypot(dx, dy) - 1) < 1e-12);
    assert.ok(Math.abs(k - (2 * Math.PI) / w.wavelength) < 1e-12);
    assert.ok(Math.abs(omega - Math.sqrt(WAVE_GRAVITY * k)) < 1e-12);
  }
});

test("wavesGlsl declares one array entry per wave", () => {
  const src = wavesGlsl(WAVES);
  assert.match(src, new RegExp(`WAVE_COUNT = ${WAVES.length};`));
  assert.equal(src.match(/vec4\(/g)?.length, WAVES.length);
  assert.equal(src.match(/vec2\(/g)?.length, WAVES.length);
});
