import { setText } from "../../ui/dom.ts";

/** Seconds between readouts, so the number is readable. */
const WINDOW = 0.5;

/** Frames per second over the last half second, and the slowest frame in it. */
export class FpsMeter {
  private frames = 0;
  private elapsed = 0;
  private worst = 0;

  constructor(private readonly node: HTMLElement) {}

  /** Call once per frame with the real frame time in seconds. */
  tick(dt: number): void {
    this.frames++;
    this.elapsed += dt;
    this.worst = Math.max(this.worst, dt);
    if (this.elapsed < WINDOW) return;
    setText(this.node, `${Math.round(this.frames / this.elapsed)} fps · worst ${Math.round(this.worst * 1000)} ms`);
    this.frames = 0;
    this.elapsed = 0;
    this.worst = 0;
  }
}
