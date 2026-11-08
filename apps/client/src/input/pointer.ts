import { addTilt, pan, rotate, type Camera } from "../game/camera.ts";
import type { Actions } from "./actions.ts";

const DRAG_PX = 5;
const WHEEL_STEP = 1.0015;
const DOUBLE_MS = 350;
const DOUBLE_PX = 6;
/** Radians per CSS pixel of Ctrl+middle-drag. */
const ORBIT_PER_PX = 0.005;
/** Radians per wheel pixel of Ctrl+wheel. */
const TILT_PER_WHEEL = 0.0015;

interface Drag {
  button: number;
  /** Middle-drag with Ctrl held: orbit instead of pan. */
  orbit: boolean;
  /** Right-press with Ctrl held: a rally click, never a curve. */
  rally: boolean;
  /** Left press in a target mode: its release picks the target. No box, no selection. */
  target: boolean;
  /** Right-drag that started on scrap with an engineer selected: an area reclaim, never a curve. */
  area: boolean;
  /** `dragCancels()` at the press. A change means Esc or blur cancelled this drag. */
  cancels: number;
  x0: number;
  y0: number;
  x: number;
  y: number;
  moved: boolean;
}

interface Click {
  at: number;
  x: number;
  y: number;
}

/**
 * Mouse on the canvas: left select (double-click: same kind on screen; Ctrl: on the whole map), right command on release (Shift: queue, Alt: force,
 * Ctrl: rally), right-drag curve move (from scrap with an engineer selected: area reclaim),
 * middle-drag pan (Ctrl: orbit and tilt), wheel zoom (Ctrl: tilt).
 * In a target mode (guard, attack-move) a left click picks the target (Shift: queue, Alt: force)
 * and a right press leaves the mode. Esc or window blur cancels a right drag with no order.
 */
export class Pointer {
  /** Last position in CSS pixels; null while outside the window. Read by edge pan. */
  position: { x: number; y: number } | null = null;
  private drag: Drag | null = null;
  private lastClick: Click | null = null;
  private targetCursor = false;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly cam: Camera,
    private readonly actions: Actions,
  ) {
    canvas.addEventListener("pointerdown", (e) => this.down(e));
    window.addEventListener("pointermove", (e) => this.move(e));
    window.addEventListener("pointerup", (e) => this.up(e));
    document.addEventListener("mouseout", (e) => {
      if (!e.relatedTarget) this.position = null;
    });
    canvas.addEventListener("wheel", (e) => this.wheel(e), { passive: false });
    canvas.addEventListener("contextmenu", (e) => e.preventDefault());
    window.addEventListener("blur", () => this.actions.cancelDrag());
  }

  /** Crosshair over the canvas while in a target mode. Writes the style only on a change. */
  showTargetCursor(on: boolean): void {
    if (on === this.targetCursor) return;
    this.targetCursor = on;
    this.canvas.style.cursor = on ? "crosshair" : "";
  }

  private down(e: PointerEvent): void {
    e.preventDefault();
    const targeting = this.actions.targetMode() !== null;
    // A right press in a target mode only leaves the mode.
    if (targeting && e.button === 2) return void this.actions.cancel();
    const [x, y] = this.local(e);
    this.drag = {
      button: e.button, orbit: e.button === 1 && e.ctrlKey, rally: e.button === 2 && e.ctrlKey,
      target: targeting && e.button === 0, area: false, cancels: this.actions.dragCancels(), x0: x, y0: y, x, y, moved: false,
    };
    if (e.button === 0 && !targeting) this.actions.boxStart(x, y);
    this.canvas.setPointerCapture(e.pointerId);
  }

  private move(e: PointerEvent): void {
    const [x, y] = this.local(e);
    this.position = { x, y };
    const d = this.liveDrag();
    if (!d) return;
    if (d.button === 1) this.middleDrag(d.orbit, x - d.x, y - d.y);
    d.x = x;
    d.y = y;
    const wasMoved = d.moved;
    d.moved ||= Math.hypot(x - d.x0, y - d.y0) > DRAG_PX;
    if (d.button === 2 && d.moved && !d.rally) this.rightDrag(wasMoved, d, x, y);
  }

  private up(e: PointerEvent): void {
    const d = this.liveDrag();
    if (!d || e.button !== d.button) return;
    this.drag = null;
    if (d.button === 2) return this.rightUp(d, e);
    if (d.button !== 0) return;
    if (d.target) return this.actions.targetAt(d.x0, d.y0, { force: e.altKey, queue: e.shiftKey });
    if (d.moved) {
      this.actions.boxDrag(d.x, d.y);
      this.actions.boxSelect(e.shiftKey);
    } else {
      this.actions.boxCancel();
      this.click(d.x0, d.y0, e.timeStamp, e.shiftKey, e.ctrlKey);
    }
  }

  /** Per frame while a selection box is dragged: its free corner follows the cursor over the ground, even when the camera moves under a still cursor. */
  refreshBox(): void {
    const d = this.drag;
    if (d && d.button === 0 && d.moved && !d.target) this.actions.boxDrag(d.x, d.y);
  }

  /** The drag in progress. A right drag cancelled by Esc or blur ends here, so its moves and release do nothing. */
  private liveDrag(): Drag | null {
    const d = this.drag;
    if (d && d.button === 2 && d.cancels !== this.actions.dragCancels()) this.drag = null;
    return this.drag;
  }

  /**
   * A right drag that starts on scrap with an engineer selected is an area reclaim; any other is a curve move.
   * The first sample of a curve is the press point, so the curve starts where the drag did.
   */
  private rightDrag(wasMoved: boolean, d: Drag, x: number, y: number): void {
    if (!wasMoved) d.area = this.actions.areaStart(d.x0, d.y0);
    if (d.area) return this.actions.areaTo(x, y);
    if (!wasMoved) this.actions.curveTo(d.x0, d.y0);
    this.actions.curveTo(x, y);
  }

  /** A right drag sends the area reclaim or the curve; a right click (or any Ctrl+right press) sends the click command at the press point. */
  private rightUp(d: Drag, e: PointerEvent): void {
    const mods = { force: e.altKey, queue: e.shiftKey };
    if (!d.moved || d.rally) return this.actions.command(d.x0, d.y0, mods, d.rally);
    if (d.area) {
      this.actions.areaTo(d.x, d.y);
      return this.actions.commandArea(mods);
    }
    this.actions.curveTo(d.x, d.y);
    this.actions.commandCurve(mods);
  }

  /** In the pick phase a click chooses the spot. Else a double click selects the clicked kind: on screen, or with Ctrl across the whole map. */
  private click(x: number, y: number, at: number, shift: boolean, ctrl: boolean): void {
    if (this.actions.chooseSpot(x, y)) return; // the pick phase: the click is a spot, not a selection
    const prev = this.lastClick;
    const double = prev !== null && at - prev.at <= DOUBLE_MS && Math.hypot(x - prev.x, y - prev.y) <= DOUBLE_PX;
    this.lastClick = double ? null : { at, x, y };
    if (double) this.actions.kindSelect(x, y, shift, ctrl);
    else this.actions.clickSelect(x, y, shift);
  }

  /** Orbit: horizontal drag turns the view around the look-at point, vertical drag up tilts toward the horizon. */
  private middleDrag(orbit: boolean, dx: number, dy: number): void {
    if (!orbit) return pan(this.cam, dx, dy);
    rotate(this.cam, dx * ORBIT_PER_PX);
    addTilt(this.cam, dy * ORBIT_PER_PX);
  }

  /** Ctrl+wheel up tilts toward the horizon; plain wheel zooms toward the cursor. */
  private wheel(e: WheelEvent): void {
    e.preventDefault();
    const delta = e.deltaMode === 1 ? e.deltaY * 30 : e.deltaY;
    if (e.ctrlKey) addTilt(this.cam, delta * TILT_PER_WHEEL);
    else this.actions.zoom(e.offsetX, e.offsetY, Math.pow(WHEEL_STEP, -delta));
  }

  private local(e: PointerEvent): [number, number] {
    const r = this.canvas.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  }
}
