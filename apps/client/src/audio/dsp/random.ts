/** A random source: uniform in [0, 1). Layers take one, so a seed fixes the whole sound. */
export type Rng = () => number;

/** Pure. A seeded generator (mulberry32). The same seed gives the same sequence. */
export function rng(seed: number): Rng {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** `x` scaled by a random factor in [1 - amt, 1 + amt]. */
export function jit(r: Rng, x: number, amt = 0.15): number {
  return x * (1 + amt * (2 * r() - 1));
}
