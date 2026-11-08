import type { Rng } from "./random.ts";

/** Samples in `sec` seconds at `sr`. */
export function len(sr: number, sec: number): number {
  return Math.floor(sec * sr);
}

/** `sec` seconds of white noise in [-1, 1). */
export function noise(sr: number, sec: number, r: Rng): Float32Array {
  const out = new Float32Array(len(sr, sec));
  for (let i = 0; i < out.length; i++) out[i] = r() * 2 - 1;
  return out;
}

/** Largest absolute sample. */
export function peakOf(b: Float32Array): number {
  let m = 0;
  for (let i = 0; i < b.length; i++) m = Math.max(m, Math.abs(b[i]!));
  return m;
}

/** Scales `b` in place so its peak is `to` (silence stays silent). Returns it. */
export function norm(b: Float32Array, to = 1): Float32Array {
  const p = peakOf(b) || 1;
  for (let i = 0; i < b.length; i++) b[i] = (b[i]! / p) * to;
  return b;
}

/** One layer of a mix: the sound, its start in seconds, its gain. */
export type Layer = readonly [buf: Float32Array, at: number, gain: number];

/** `sec` seconds holding every layer added at its start and gain. Layers past the end are cut. */
export function sum(sr: number, sec: number, layers: readonly Layer[]): Float32Array<ArrayBuffer> {
  const out = new Float32Array(len(sr, sec));
  for (const [buf, at, gain] of layers) {
    const o = len(sr, at);
    for (let i = 0; i < buf.length && i + o < out.length; i++) out[i + o]! += buf[i]! * gain;
  }
  return out;
}
