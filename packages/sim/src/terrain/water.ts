import { heightAt } from "../terrain.ts";
import type { Terrain } from "../types.ts";

/** Height units the sea stands above the lowest starting vertex. */
export const WATER_LEVEL = 60;

/** The sea level for a height map: its lowest vertex plus WATER_LEVEL. */
export function seaLevelOf(heights: readonly number[]): number {
  let min = Infinity;
  for (const h of heights) if (h < min) min = h;
  return (min === Infinity ? 0 : min) + WATER_LEVEL;
}

/** True when the ground at (x, y) is below the sea level. */
export function inWater(terrain: Terrain, x: number, y: number): boolean {
  return heightAt(terrain, x, y) < terrain.seaLevel;
}
