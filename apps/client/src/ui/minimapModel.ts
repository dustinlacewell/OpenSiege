// Minimap geometry: the canvas follows the map's aspect. Pure.
import type { MapSize } from "@mf/sim";

/** A canvas size in pixels. */
export interface Extent {
  w: number;
  h: number;
}

/** The canvas for a map: the longer side is `size`, the other keeps the map's aspect. */
export function minimapExtent(map: MapSize, size: number): Extent {
  if (map.width >= map.height) return { w: size, h: Math.max(1, Math.round((size * map.height) / map.width)) };
  return { w: Math.max(1, Math.round((size * map.width) / map.height)), h: size };
}

/** Canvas pixels per world unit. Both axes share it. */
export function minimapScale(map: MapSize, extent: Extent): number {
  return extent.w / map.width;
}

/** The world point under a click at fractions (fx, fy) of the canvas box. Per-axis, so it holds when the box is stretched. */
export function minimapWorld(map: MapSize, fx: number, fy: number): { x: number; y: number } {
  return { x: fx * map.width, y: fy * map.height };
}
