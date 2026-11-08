import { len, noise, norm } from "./buffers.ts";
import { Biquad, filt } from "./filters.ts";
import type { Rng } from "./random.ts";

// The layers of a blast, after Farnell. Each is pure: a sample rate and a random source in, a peak-normalised mono buffer out.

/** Rise over `rise`, fall to zero over `fall`, squared (Farnell's line envelope). */
function riseFall(t: number, rise: number, fall: number): number {
  const e = t < rise ? t / rise : Math.max(0, 1 - (t - rise) / fall);
  return e * e;
}

/**
 * Shockwave: a Friedlander pressure pulse, the measured shape of a blast wave. An instant rise,
 * a fall through zero at `T`, then a long shallow negative phase. It has no pitch.
 * Low-passed at `lp`: high for a hard crack, low for a body thump.
 */
export function shockwave(sr: number, T: number, lp: number): Float32Array {
  const out = new Float32Array(len(sr, T * 12));
  for (let i = 0; i < out.length; i++) {
    const t = i / sr;
    out[i] = (1 - t / T) * Math.exp((-1.4 * t) / T);
  }
  filt(out, sr, "lp", lp, 0.6, 2);
  return norm(filt(out, sr, "hp", 20, 0.7));
}

export interface FireballParams { rise: number; fall: number; fLow: number; fSpan: number }

/** Fireball: noise band-passed at 70 Hz, low-passed with a cutoff that falls with the envelope. */
export function fireball(sr: number, r: Rng, { rise, fall, fLow, fSpan }: FireballParams): Float32Array {
  const n = noise(sr, rise + fall + 0.05, r);
  const env = (t: number) => riseFall(t, rise, fall);
  filt(n, sr, "bp", 70, 1);
  filt(n, sr, "lp", (t) => fLow + fSpan * Math.sqrt(env(t)), 0.707, 2);
  for (let i = 0; i < n.length; i++) n[i]! *= env(i / sr);
  return norm(filt(n, sr, "hp", 25, 0.7));
}

export interface AirParams { decay: number; lp: number; hp: number }

/** Air: the blast's roar. Noise rounded by tanh (not hard-clipped), band-limited, decayed. */
export function air(sr: number, r: Rng, { decay, lp, hp }: AirParams): Float32Array {
  const n = noise(sr, decay * 7, r);
  for (let i = 0; i < n.length; i++) n[i] = Math.tanh(n[i]! * 3) * Math.exp(-i / sr / decay);
  filt(n, sr, "lp", lp, 0.7, 2);
  return norm(filt(n, sr, "hp", hp, 0.7, 2));
}

export interface DustParams { start: number; peak: number; end: number; lp: number }

/** Dust: dirt raining back. Smooth gritty level, kept low-passed so it reads as earth. */
export function dust(sr: number, r: Rng, { start, peak, end, lp }: DustParams): Float32Array {
  const n = noise(sr, end + 0.05, r);
  let g = 0, target = 0;
  for (let i = 0; i < n.length; i++) {
    const t = i / sr;
    if (i % 120 === 0) target = r() ** 2;
    g += 0.02 * (target - g);
    let env = 0;
    if (t > start && t < end) env = t < peak ? (t - start) / (peak - start) : (1 - (t - peak) / (end - peak)) ** 2;
    n[i]! *= env * g;
  }
  filt(n, sr, "lp", lp, 0.7, 2);
  return norm(filt(n, sr, "hp", 180, 0.7, 2));
}

export interface BodyParams { rise: number; fall: number; f0: number; f1: number; hp?: number; grit?: boolean }

/**
 * Body: the weight of the blast, in the 150-1000 Hz band that phones play and ears weigh.
 * Dense noise whose cutoff falls `f0` -> `f1`, a fast rise, a decay over `fall`, a rough churn.
 * Most of the blast's energy is here; the sub and the crack only frame it.
 * `grit` drives it into saturation so the smooth roar turns rough, then takes off the fizz.
 */
export function body(sr: number, r: Rng, { rise, fall, f0, f1, hp = 90, grit = true }: BodyParams): Float32Array {
  const n = noise(sr, rise + fall + 0.05, r);
  let churn = 1, target = 1;
  for (let i = 0; i < n.length; i++) {
    const t = i / sr;
    if (i % 480 === 0) target = 0.6 + 0.8 * r();
    churn += 0.004 * (target - churn);
    const env = t < rise ? t / rise : Math.exp((-4 * (t - rise)) / fall);
    n[i]! *= env * churn;
  }
  filt(n, sr, "lp", (t) => f1 + (f0 - f1) * Math.exp((-3 * t) / fall), 0.6, 2);
  filt(n, sr, "hp", hp, 0.6, 2);
  if (!grit) return norm(n);
  norm(n);
  for (let i = 0; i < n.length; i++) n[i] = Math.tanh(n[i]! * 4);
  return norm(filt(n, sr, "lp", 2600, 0.6, 2));
}

export interface CrunchParams {
  sec: number;
  /** Grains per second at the start. */
  rate: number;
  decay: number;
  fLow: number;
  fHigh: number;
  /** Shortest and longest grain, ms. */
  grainMs: readonly [number, number];
  drive: number;
}

/**
 * Crunch: thousands of tiny violent bursts. Rock, steel, air tearing. Grains start dense and thin out
 * over `decay`. Each is 1-10 ms of noise in a random band between `fLow` and `fHigh`; loudness is heavy-tailed,
 * so most are small and a few are hard. The sum is driven into saturation for grit.
 */
export function crunch(sr: number, r: Rng, { sec, rate, decay, fLow, fHigh, grainMs, drive }: CrunchParams): Float32Array {
  const out = new Float32Array(len(sr, sec));
  const bq = new Biquad(sr);
  for (let i = 0; i < out.length; i += 24) {
    const t = i / sr;
    if (r() > ((rate * 24) / sr) * Math.exp(-t / decay)) continue;
    const g = noise(sr, (grainMs[0] + (grainMs[1] - grainMs[0]) * r() ** 2) / 1000, r);
    const tau = g.length / sr / 3;
    const amp = Math.min(6, r() ** -0.6) * Math.exp(-t / (decay * 1.5));
    const fc = fLow * Math.pow(fHigh / fLow, r());
    bq.reset();
    bq.set("bp", fc, 0.9 + r());
    for (let k = 0; k < g.length && i + k < out.length; k++) out[i + k]! += bq.p(g[k]! * Math.exp(-k / sr / tau)) * amp;
  }
  norm(out);
  for (let i = 0; i < out.length; i++) out[i] = Math.tanh(out[i]! * drive);
  return norm(filt(out, sr, "lp", fHigh * 1.3, 0.6, 2));
}
