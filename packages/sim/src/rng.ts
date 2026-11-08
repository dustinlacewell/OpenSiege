import type { World } from "./types.ts";

/** mulberry32 over world.rng. Returns a uint32 and advances the state. */
export function nextU32(world: World): number {
  const s = (world.rng + 0x6d2b79f5) >>> 0;
  world.rng = s;
  let t = Math.imul(s ^ (s >>> 15), s | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return (t ^ (t >>> 14)) >>> 0;
}

/** Integer in lo..hi inclusive. */
export function randInt(world: World, lo: number, hi: number): number {
  return lo + (nextU32(world) % (hi - lo + 1));
}
