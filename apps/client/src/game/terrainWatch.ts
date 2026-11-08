import type { VertexBox } from "@mf/sim";

/** The smallest box holding both. */
export function unionBox(a: VertexBox, b: VertexBox): VertexBox {
  return { i0: Math.min(a.i0, b.i0), j0: Math.min(a.j0, b.j0), i1: Math.max(a.i1, b.i1), j1: Math.max(a.j1, b.j1) };
}

/**
 * Collects the terrain boxes the sim changed over the steps of one frame, so the frame can hand
 * its consumers one box. `note` after each step; `take` once per frame.
 */
export class TerrainWatch {
  private box: VertexBox | null = null;

  /** Adds boxes. The input is read, not kept. */
  note(boxes: readonly VertexBox[]): void {
    for (const b of boxes) this.box = this.box ? unionBox(this.box, b) : { ...b };
  }

  /** The union of everything noted since the last `take`, or null if nothing. Clears. */
  take(): VertexBox | null {
    const b = this.box;
    this.box = null;
    return b;
  }
}
