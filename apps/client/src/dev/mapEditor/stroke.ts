import type { Edit, Tool } from "@mf/map";

/** Dabs are at least this share of the radius apart, so a slow drag does not stack hundreds of dabs. */
const SPACING = 0.15;
const GOLDEN = 0x9e3779b1;

/** One pointer stroke: its tool, its dabs' edits, and where the next dab is due. */
export class Stroke {
  readonly edits: Edit[] = [];
  private dabs = 0;
  private lastX = 0;
  private lastY = 0;

  /** `once`: only the first dab counts (the place tools). */
  constructor(readonly tool: Tool, private readonly seed: number, private readonly radius: number, private readonly once: boolean) {}

  /** True when a dab at (x, y) should run. */
  due(x: number, y: number): boolean {
    if (this.dabs === 0) return true;
    if (this.once) return false;
    return Math.hypot(x - this.lastX, y - this.lastY) >= this.radius * SPACING;
  }

  /** A seed per dab, from the stroke's own. */
  dabSeed(): number {
    return (this.seed + Math.imul(this.dabs, GOLDEN)) >>> 0;
  }

  record(x: number, y: number, edits: readonly Edit[]): void {
    this.dabs++;
    this.lastX = x;
    this.lastY = y;
    this.edits.push(...edits);
  }

  touchedHeights(): boolean {
    return this.edits.some((e) => e.t === "height");
  }
}
