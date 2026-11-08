import { heightAt } from "./terrain.ts";
import type { Terrain } from "./types.ts";

/** Height spread over the centre and four points at distance r. 0 = flat. */
export function roughness(t: Terrain, x: number, y: number, r: number): number {
  const h = [
    heightAt(t, x, y),
    heightAt(t, x + r, y),
    heightAt(t, x - r, y),
    heightAt(t, x, y + r),
    heightAt(t, x, y - r),
  ];
  return Math.max(...h) - Math.min(...h);
}
