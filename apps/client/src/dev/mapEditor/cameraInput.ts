import type { Terrain } from "@mf/sim";
import { addTilt, pan, rotate, type Camera } from "../../game/camera.ts";
import { zoomAt } from "../../game/zoom.ts";
import { panVector } from "../../input/pan.ts";
import type { EditorKeys } from "./keys.ts";

// Same gesture constants as the game's `input/pointer.ts`.
const WHEEL_STEP = 1.0015;
const ORBIT_PER_PX = 0.005;
const TILT_PER_WHEEL = 0.0015;
const MIDDLE = 1;
/** `MouseEvent.buttons` bit of the right button. */
const RIGHT_HELD = 2;
/** About 4% of the radius per wheel notch. */
const BRUSH_WHEEL_STEP = 1.0004;
/** About 0.02 of strength per wheel notch. */
const STRENGTH_PER_WHEEL = 0.0002;

/** About 0.02 of falloff per wheel notch. */
const FALLOFF_PER_WHEEL = 0.0002;
/** About 10% of the density per wheel notch. */
const DENSITY_WHEEL_STEP = 1.001;

/** The wheel gestures that change the brush. */
export interface BrushWheel {
  scale(factor: number): void;
  strength(delta: number): void;
  falloff(delta: number): void;
  density(factor: number): void;
}

/**
 * The game's camera gestures on the editor canvas: middle-drag pans, Ctrl+middle-drag orbits and tilts, the wheel
 * zooms toward the cursor, Shift+wheel tilts. Two wheel gestures are the brush's, not the camera's: Ctrl+wheel scales
 * the radius, the wheel with the right button held changes the strength, F+wheel the falloff, C+wheel the density.
 * Held keys pan in `update`. `cam` is the target camera; the shown one eases toward it (`cameraEase.ts`).
 */
export class CameraInput {
  private drag: { orbit: boolean; x: number; y: number } | null = null;

  constructor(
    canvas: HTMLCanvasElement,
    private readonly cam: Camera,
    private readonly keys: EditorKeys,
    terrain: () => Terrain,
    private readonly brush: BrushWheel,
  ) {
    canvas.addEventListener("pointerdown", (e) => {
      if (e.button !== MIDDLE) return;
      e.preventDefault();
      this.drag = { orbit: e.ctrlKey, x: e.clientX, y: e.clientY };
      canvas.setPointerCapture(e.pointerId);
    });
    window.addEventListener("pointermove", (e) => this.move(e));
    window.addEventListener("pointerup", (e) => {
      if (e.button === MIDDLE) this.drag = null;
    });
    canvas.addEventListener("wheel", (e) => this.wheel(e, terrain()), { passive: false });
    canvas.addEventListener("contextmenu", (e) => e.preventDefault());
  }

  /** Key pan for this frame. `dt` in seconds. */
  update(dt: number): void {
    const cam = this.cam;
    const [dx, dy] = panVector({ ...this.keys.pan(), pointer: null, width: cam.width, height: cam.height }, dt);
    if (dx !== 0 || dy !== 0) pan(cam, -dx, -dy);
  }

  private move(e: PointerEvent): void {
    const d = this.drag;
    if (!d) return;
    const dx = e.clientX - d.x, dy = e.clientY - d.y;
    d.x = e.clientX;
    d.y = e.clientY;
    if (!d.orbit) return pan(this.cam, dx, dy);
    rotate(this.cam, dx * ORBIT_PER_PX);
    addTilt(this.cam, dy * ORBIT_PER_PX);
  }

  /** True when `code` is held; the key is then the wheel's, not the pan's. */
  private keyWheel(code: string): boolean {
    if (!this.keys.isHeld(code)) return false;
    this.keys.claim(code);
    return true;
  }

  private wheel(e: WheelEvent, terrain: Terrain): void {
    e.preventDefault();
    // Shift turns a vertical wheel into a horizontal one in some browsers.
    const raw = e.deltaY || e.deltaX;
    const delta = e.deltaMode === 1 ? raw * 30 : raw;
    if (e.buttons & RIGHT_HELD) this.brush.strength(-delta * STRENGTH_PER_WHEEL);
    else if (this.keyWheel("KeyF")) this.brush.falloff(-delta * FALLOFF_PER_WHEEL);
    else if (this.keyWheel("KeyC")) this.brush.density(Math.pow(DENSITY_WHEEL_STEP, -delta));
    else if (e.ctrlKey) this.brush.scale(Math.pow(BRUSH_WHEEL_STEP, -delta));
    else if (e.shiftKey) addTilt(this.cam, delta * TILT_PER_WHEEL);
    else zoomAt(this.cam, terrain, e.offsetX, e.offsetY, Math.pow(WHEEL_STEP, -delta));
  }
}
