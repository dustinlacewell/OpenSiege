import { heightAt } from "./terrain.ts";
import { cosStep, sinStep, TRIG_ONE } from "./trig.ts";
import type { Terrain } from "./types.ts";

// How a hull tilts on the ground under it. Pure integer math; the client draws the same tilt (`game/poses.ts`).

/** Hull slopes in permille (rise per 1000 run). `fwd` > 0: the nose is up. `side` > 0: the left (+90°) side is up. */
export interface HullSlope { fwd: number; side: number }

/**
 * The slopes of a hull of `radius` at (x, y) facing `facing` angle steps: ground heights sampled
 * d = floor(radius · 0.8) ahead and behind, and left and right, along the hull yaw.
 */
export function hullSlope(terrain: Terrain, x: number, y: number, facing: number, radius: number): HullSlope {
  const d = Math.max(1, Math.floor((radius * 4) / 5));
  const fx = Math.round((cosStep(facing) * d) / TRIG_ONE);
  const fy = Math.round((sinStep(facing) * d) / TRIG_ONE);
  const h = (px: number, py: number) => heightAt(terrain, px, py);
  return {
    fwd: Math.trunc(((h(x + fx, y + fy) - h(x - fx, y - fy)) * 1000) / (2 * d)),
    side: Math.trunc(((h(x - fy, y + fx) - h(x + fy, y - fx)) * 1000) / (2 * d)),
  };
}
