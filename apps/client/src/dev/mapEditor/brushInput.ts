import type { Terrain } from "@mf/sim";
import type { Camera } from "../../game/camera.ts";
import { vec3 } from "../../game/mat4.ts";
import { groundAt } from "../../game/picking.ts";

/** Where a stroke goes: world ground points. */
export interface StrokeSink {
  beginStroke(x: number, y: number): void;
  paint(x: number, y: number): void;
  endStroke(): void;
}

const LEFT = 0;

/** Left-drag paints: the pointer's ground point starts, continues and ends a stroke. Tracks the hover point for the cursor ring. */
export class BrushInput {
  private screen: { x: number; y: number } | null = null;
  private painting = false;
  private readonly at = vec3();

  constructor(private readonly canvas: HTMLCanvasElement, private readonly cam: Camera, private readonly terrain: () => Terrain, private readonly sink: StrokeSink) {
    canvas.addEventListener("pointerdown", (e) => this.down(e));
    window.addEventListener("pointermove", (e) => this.move(e));
    window.addEventListener("pointerup", (e) => this.up(e));
    canvas.addEventListener("pointerleave", () => {
      if (!this.painting) this.screen = null;
    });
  }

  /** The ground point under the pointer this frame, or null when off the canvas or above the horizon. */
  hover(): { x: number; y: number } | null {
    return this.screen && this.pick(this.screen.x, this.screen.y) ? { x: this.at[0]!, y: this.at[1]! } : null;
  }

  private down(e: PointerEvent): void {
    (document.activeElement as HTMLElement | null)?.blur();
    if (e.button !== LEFT) return;
    e.preventDefault();
    this.screen = this.local(e);
    if (!this.pick(this.screen.x, this.screen.y)) return;
    this.painting = true;
    this.canvas.setPointerCapture(e.pointerId);
    this.sink.beginStroke(this.at[0]!, this.at[1]!);
  }

  private move(e: PointerEvent): void {
    this.screen = this.painting || e.target === this.canvas ? this.local(e) : null;
    if (this.screen && this.painting && this.pick(this.screen.x, this.screen.y)) this.sink.paint(this.at[0]!, this.at[1]!);
  }

  private up(e: PointerEvent): void {
    if (e.button !== LEFT || !this.painting) return;
    this.painting = false;
    this.sink.endStroke();
  }

  private pick(sx: number, sy: number): boolean {
    return groundAt(this.cam, this.terrain(), sx, sy, this.at);
  }

  private local(e: PointerEvent): { x: number; y: number } {
    const r = this.canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }
}
