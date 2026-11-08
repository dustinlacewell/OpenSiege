import type { SampledCue } from "./cues.ts";
import { len, norm, sum } from "./dsp/buffers.ts";
import { echoes, LAND_ECHOES } from "./dsp/echo.ts";
import { air, body, crunch, dust, fireball, shockwave } from "./dsp/layers.ts";
import { jit, rng, type Rng } from "./dsp/random.ts";

/** Pure. One weapon sound: mono at `sr`, peak 0.9, echoes baked in. `seed` picks the variant; `size` is 0..1. */
// sr is sample rate, probably
export type Recipe = (sr: number, seed: number, size: number) => Float32Array<ArrayBuffer>;

/** A dry sound, before the echoes. */
type Dry = (sr: number, r: Rng, size: number) => Float32Array<ArrayBuffer>;

const PEAK = 0.9;
/** How much of the land echoes goes under the dry sound. */
const ECHO_MIX = 0.3;
const FADE_SECONDS = 0.004;

export const RECIPES: Record<SampledCue, Recipe> = {
  shotBallistic: recipe(howitzer),
  shellGround: recipe(groundHit),
  shellArmor: recipe(armorHit),
  shotDirect: recipe(tankGun),
  roundGround: recipe(roundGround),
  roundArmor: recipe(roundArmor),
};

/** Wraps a dry sound: seed it, add the echoes, normalise, fade the last 4 ms. */
function recipe(dry: Dry): Recipe {
  return (sr, seed, size) => finish(dry(sr, rng(seed), size), sr);
}

function finish(dry: Float32Array<ArrayBuffer>, sr: number): Float32Array<ArrayBuffer> {
  const wet = echoes(dry, sr, LAND_ECHOES);
  for (let i = 0; i < dry.length; i++) dry[i]! += ECHO_MIX * wet[i]!;
  norm(dry, PEAK);
  const fade = Math.min(dry.length, len(sr, FADE_SECONDS));
  for (let k = 0; k < fade; k++) dry[dry.length - 1 - k]! *= k / fade;
  return dry;
}

/** Howitzer firing: a clean, short report. One "thoom", no crunch, no debris. */
function howitzer(sr: number, r: Rng, size: number): Float32Array<ArrayBuffer> {
  const fall = jit(r, 0.36 * size);
  return sum(sr, 0.9, [
    [body(sr, r, { rise: 0.002, fall, f0: jit(r, 1400), f1: jit(r, 500), grit: false, hp: 500 }), 0, 1.0],
    [shockwave(sr, jit(r, 0.05), 200), 0, 0.5],
    [air(sr, r, { decay: jit(r, 0.10), lp: jit(r, 3000), hp: 200 }), 0, 0.05],
    [fireball(sr, r, { rise: 0.01, fall: fall * 1.5, fLow: 45, fSpan: 110 }), 0.005, 0.80],
  ]);
}

/** Shell into dirt: the earth soaks up the blast. A slower, darker body, a deep whump, then dirt falls. */
function groundHit(sr: number, r: Rng, size: number): Float32Array<ArrayBuffer> {
  const fall = jit(r, 0.9 + 0.6 * size);
  return sum(sr, fall + 0.2, [
    [body(sr, r, { rise: 0.008, fall, f0: jit(r, 700), f1: jit(r, 180) }), 0, 1.0],
    [crunch(sr, r, { sec: 0.9, rate: 3500, decay: jit(r, 0.14), fLow: 200, fHigh: 2400, grainMs: [2, 10], drive: 3 }), 0.003, 0.6],
    [shockwave(sr, jit(r, 0.04 + 0.015 * size), 100), 0, 0.35],
    [air(sr, r, { decay: jit(r, 0.06), lp: jit(r, 1400), hp: 120 }), 0, 0.2],
    [fireball(sr, r, { rise: jit(r, 0.05), fall, fLow: 35, fSpan: jit(r, 90) }), 0.01, 0.8],
    [dust(sr, r, { start: jit(r, 0.1), peak: jit(r, 0.32), end: jit(r, 0.9 + 0.3 * size), lp: jit(r, 2000) }), 0, 0.14],
  ]);
}

/** Shell into thick steel: heavy, not bright. A hard body, a dense crunch of torn metal, a smaller fireball, no dirt. */
function armorHit(sr: number, r: Rng, size: number): Float32Array<ArrayBuffer> {
  const fall = jit(r, 0.6 + 0.3 * size);
  return sum(sr, fall + 0.15, [
    [body(sr, r, { rise: 0.002, fall, f0: jit(r, 1100), f1: jit(r, 300) }), 0, 1.0],
    [air(sr, r, { decay: jit(r, 0.05), lp: jit(r, 1800), hp: 250 }), 0, 0.3],
    [crunch(sr, r, { sec: 0.6, rate: 7000, decay: jit(r, 0.09), fLow: 400, fHigh: 3500, grainMs: [1, 5], drive: 4 }), 0, 0.7],
    [shockwave(sr, jit(r, 0.025), 120), 0, 0.3],
    [shockwave(sr, jit(r, 0.002), 3500), 0, 0.12],
    [fireball(sr, r, { rise: jit(r, 0.03), fall, fLow: 50, fSpan: jit(r, 160) }), 0.02, 0.5],
  ]);
}

/** Tank main gun: sharper and shorter than the howitzer, but not thin. */
function tankGun(sr: number, r: Rng, size: number): Float32Array<ArrayBuffer> {
  const fall = jit(r, 0.16 + 0.08 * size);
  return sum(sr, 0.6, [
    [body(sr, r, { rise: 0.002, fall, f0: jit(r, 1800), f1: jit(r, 500), grit: false }), 0, 1.0],
    [shockwave(sr, jit(r, 0.01), 300), 0, 0.5],
    [air(sr, r, { decay: jit(r, 0.015), lp: jit(r, 4000), hp: 300 }), 0, 0.25],
    [fireball(sr, r, { rise: 0.005, fall: fall * 1.2, fLow: 50, fSpan: 140 }), 0, 0.25],
  ]);
}

/** Tank round into dirt: a short thud and a spray of earth. */
function roundGround(sr: number, r: Rng, size: number): Float32Array<ArrayBuffer> {
  const fall = jit(r, 0.35 + 0.2 * size);
  return sum(sr, fall + 0.2, [
    [body(sr, r, { rise: 0.004, fall, f0: jit(r, 800), f1: jit(r, 220) }), 0, 1.0],
    [crunch(sr, r, { sec: 0.5, rate: 3000, decay: jit(r, 0.08), fLow: 200, fHigh: 2200, grainMs: [2, 8], drive: 3 }), 0, 0.55],
    [shockwave(sr, jit(r, 0.02), 120), 0, 0.3],
    [dust(sr, r, { start: jit(r, 0.08), peak: jit(r, 0.22), end: jit(r, 0.6), lp: jit(r, 2000) }), 0, 0.1],
  ]);
}

/** Tank round into steel: a hard clang of torn metal, no dirt. */
function roundArmor(sr: number, r: Rng, size: number): Float32Array<ArrayBuffer> {
  const fall = jit(r, 0.3 + 0.15 * size);
  return sum(sr, fall + 0.15, [
    [body(sr, r, { rise: 0.0015, fall, f0: jit(r, 1200), f1: jit(r, 320) }), 0, 1.0],
    [crunch(sr, r, { sec: 0.45, rate: 9000, decay: jit(r, 0.05), fLow: 400, fHigh: 3500, grainMs: [1, 4], drive: 4 }), 0, 0.75],
    [air(sr, r, { decay: jit(r, 0.02), lp: jit(r, 1800), hp: 250 }), 0, 0.3],
    [shockwave(sr, jit(r, 0.002), 3500), 0, 0.12],
    [shockwave(sr, jit(r, 0.02), 140), 0, 0.3],
  ]);
}
