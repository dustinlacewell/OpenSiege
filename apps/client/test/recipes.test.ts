import { test } from "node:test";
import assert from "node:assert/strict";
import { SAMPLED_CUES } from "../src/audio/cues.ts";
import { RECIPES } from "../src/audio/recipes.ts";

const SR = 48000;
const SIZES = [0, 0.5, 1];
const SEEDS = [1, 2];
const BANDS = [63, 125, 250, 500, 1000, 2000, 4000, 8000];

/** Octave-band energy in dB over the first `sec` seconds: one RBJ band-pass, Q 1.41, per band. */
function bandDb(x: Float32Array, sec = 1.2): Map<number, number> {
  const n = Math.min(x.length, Math.floor(SR * sec));
  const out = new Map<number, number>();
  for (const fc of BANDS) {
    const w = (2 * Math.PI * fc) / SR, a = Math.sin(w) / (2 * 1.41), c = Math.cos(w), a0 = 1 + a;
    const b0 = a / a0, b2 = -a / a0, a1 = (-2 * c) / a0, a2 = (1 - a) / a0;
    let x1 = 0, x2 = 0, y1 = 0, y2 = 0, e = 0;
    for (let i = 0; i < n; i++) {
      const xi = x[i]!;
      const y = b0 * xi + b2 * x2 - a1 * y1 - a2 * y2;
      x2 = x1; x1 = xi; y2 = y1; y1 = y;
      e += y * y;
    }
    out.set(fc, 10 * Math.log10(e + 1e-20));
  }
  return out;
}

/** Each band relative to the loudest, dB. */
function relative(x: Float32Array): Map<number, number> {
  const db = bandDb(x);
  const top = Math.max(...db.values());
  return new Map([...db].map(([f, d]) => [f, d - top]));
}

const differs = (a: Float32Array, b: Float32Array) => a.length !== b.length || a.some((v, i) => v !== b[i]);

for (const cue of SAMPLED_CUES) {
  test(`${cue}: finite, peak at most 0.9, at most 2 s, seeded`, () => {
    for (const size of SIZES) {
      for (const seed of SEEDS) {
        const x = RECIPES[cue](SR, seed, size);
        assert.ok(x.length > 0);
        assert.ok(x.length <= 2 * SR, `${cue} size ${size} seed ${seed}: ${x.length / SR} s`);
        let peak = 0;
        for (const v of x) {
          assert.ok(Number.isFinite(v));
          peak = Math.max(peak, Math.abs(v));
        }
        assert.ok(peak <= 0.9 + 1e-6, `peak ${peak}`);
        assert.deepEqual(RECIPES[cue](SR, seed, size), x);
      }
      assert.ok(differs(RECIPES[cue](SR, 1, size), RECIPES[cue](SR, 2, size)));
    }
  });

  test(`${cue}: weight in 250-500 Hz, little above 4 kHz`, () => {
    for (const size of SIZES) {
      for (const seed of SEEDS) {
        const rel = relative(RECIPES[cue](SR, seed, size));
        const at = `size ${size} seed ${seed}: ${[...rel].map(([f, d]) => `${f}:${d.toFixed(1)}`).join(" ")}`;
        assert.ok(rel.get(250)! >= -6, at);
        assert.ok(rel.get(500)! >= -6, at);
        assert.ok(rel.get(4000)! <= -10, at);
      }
    }
  });
}
