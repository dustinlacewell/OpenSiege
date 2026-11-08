import type { Terrain } from "@mf/sim";

/** Height entries compared per `check`. Bounds the cost on big maps; a dig is seen within a few frames. */
export const GROUND_WATCH_WINDOW = 8192;

export type GroundChange = "new" | "changed" | "same";

/**
 * Tells a GPU copy of the ground when to re-upload, with no hook from the sim. Pure, no GL.
 * "new": another Terrain object or grid size. "changed": the sea level moved, or a height in the
 * window checked this call differs from the copy. The window walks the grid, so any in-place change
 * is found within ceil(vertices / GROUND_WATCH_WINDOW) calls.
 */
export class GroundWatch {
  private terrain: Terrain | null = null;
  private copy = new Float64Array(0);
  private seaLevel = 0;
  private cursor = 0;

  check(terrain: Terrain): GroundChange {
    if (terrain !== this.terrain || terrain.heights.length !== this.copy.length) {
      this.take(terrain);
      return "new";
    }
    if (terrain.seaLevel !== this.seaLevel || this.windowDiffers(terrain.heights)) {
      this.take(terrain);
      return "changed";
    }
    return "same";
  }

  private take(terrain: Terrain): void {
    const h = terrain.heights;
    if (this.copy.length !== h.length) this.copy = new Float64Array(h.length);
    for (let i = 0; i < h.length; i++) this.copy[i] = h[i]!;
    this.terrain = terrain;
    this.seaLevel = terrain.seaLevel;
  }

  private windowDiffers(h: readonly number[]): boolean {
    const n = h.length;
    const end = Math.min(n, this.cursor + GROUND_WATCH_WINDOW);
    let differs = false;
    for (let i = this.cursor; i < end; i++) if (h[i] !== this.copy[i]) { differs = true; break; }
    this.cursor = end >= n ? 0 : end;
    return differs;
  }
}
