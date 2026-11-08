import { pan, type Camera } from "../game/camera.ts";
import type { Actions } from "./actions.ts";
import { Keys } from "./keys.ts";
import { panVector } from "./pan.ts";
import { Pointer } from "./pointer.ts";

/** Mouse and keyboard → camera, selection and commands. */
export class Input {
  private readonly pointer: Pointer;
  private readonly keys: Keys;

  constructor(canvas: HTMLCanvasElement, private readonly cam: Camera, private readonly actions: Actions) {
    this.pointer = new Pointer(canvas, cam, actions);
    this.keys = new Keys(actions);
  }

  /** Applies held-key and edge panning, then the selection box, the target-mode cursor and hover. `dt` in seconds. */
  update(dt: number): void {
    this.edgePan(dt);
    this.pointer.refreshBox();
    this.pointer.showTargetCursor(this.actions.targetMode() !== null);
    this.actions.hoverTarget(this.pointer.position);
  }

  private edgePan(dt: number): void {
    const cam = this.cam;
    const [dx, dy] = panVector(
      {
        left: this.keys.isHeld("ArrowLeft"),
        right: this.keys.isHeld("ArrowRight"),
        up: this.keys.isHeld("ArrowUp"),
        down: this.keys.isHeld("ArrowDown"),
        pointer: this.pointer.position,
        width: cam.width,
        height: cam.height,
      },
      dt,
    );
    if (dx !== 0 || dy !== 0) pan(cam, -dx, -dy);
  }
}
