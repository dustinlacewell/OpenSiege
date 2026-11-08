// Pure maths for the tutorial's world highlights: the pulse, unit rings, the bobbing arrow and the acted-out drag. No GL.
import { UNIT_STATS, type UnitKind } from "@mf/sim";
import type { Gesture } from "./tutorial/types.ts";

/** A unit ring pulses once in this many seconds. */
export const UNIT_PULSE_PERIOD = 1.2;
/** A zone circle pulses once in this many seconds. */
export const ZONE_PULSE_PERIOD = 2.4;
/** A unit ring's radius, as a share of the unit's radius. */
export const GUIDE_RING_SCALE = 1.8;

/** 0 at the start of each period, 1 at its middle, smooth between. */
export function pulse(time: number, period: number): number {
  return 0.5 - 0.5 * Math.cos((time / period) * Math.PI * 2);
}

/** The part of a pose a guide ring needs. */
export interface GuidePose { x: number; y: number; z: number; unit: { kind: UnitKind } }

/** One unit ring: ground centre and world radius. */
export interface GuideRing { x: number; y: number; z: number; radius: number }

/**
 * Writes a ring for each id in `units` that `find` has a pose for, into `out` from index 0.
 * Reuses the objects already in `out`. Returns how many are valid.
 */
export function guideRings(units: readonly number[], find: (id: number) => GuidePose | undefined, out: GuideRing[]): number {
  let n = 0;
  for (const id of units) {
    const p = find(id);
    if (!p) continue;
    const r = out[n] ?? (out[n] = { x: 0, y: 0, z: 0, radius: 0 });
    r.x = p.x;
    r.y = p.y;
    r.z = p.z;
    r.radius = UNIT_STATS[p.unit.kind].radius * GUIDE_RING_SCALE;
    n++;
  }
  return n;
}

// ---- Arrow ----

/** The arrow bobs once in this many seconds. */
export const ARROW_BOB_PERIOD = 0.9;
/** Arrow size as a share of the camera distance, so it reads the same at any zoom. */
const ARROW_SCALE = 0.03;
/** The arrow floats this many of its own sizes above the point it marks, plus the bob. */
const ARROW_LIFT = 0.6;
const ARROW_BOB = 0.5;

/** A 3D segment: a then b. */
export interface Seg { ax: number; ay: number; az: number; bx: number; by: number; bz: number }

/**
 * A down-pointing arrow above (x, y, z), facing the camera: a shaft and two barbs.
 * `rx, ry` = the camera's right vector on the ground. `dist` = camera distance. Writes 3 segments into `out`.
 */
export function arrowSegs(x: number, y: number, z: number, rx: number, ry: number, dist: number, time: number, out: Seg[]): void {
  const s = dist * ARROW_SCALE;
  const tip = z + s * (ARROW_LIFT + ARROW_BOB * pulse(time, ARROW_BOB_PERIOD));
  const len = Math.hypot(rx, ry) || 1;
  const wx = (rx / len) * s * 0.5, wy = (ry / len) * s * 0.5;
  put(out, 0, x, y, tip, x, y, tip + s * 1.6);
  put(out, 1, x, y, tip, x - wx, y - wy, tip + s * 0.7);
  put(out, 2, x, y, tip, x + wx, y + wy, tip + s * 0.7);
}

function put(out: Seg[], i: number, ax: number, ay: number, az: number, bx: number, by: number, bz: number): void {
  const g = out[i] ?? (out[i] = { ax: 0, ay: 0, az: 0, bx: 0, by: 0, bz: 0 });
  g.ax = ax; g.ay = ay; g.az = az; g.bx = bx; g.by = by; g.bz = bz;
}

// ---- Acted-out drag ----

/** One loop of the acted-out drag, in seconds: press, drag, hold the finished line, fade. */
export const GESTURE_PERIOD = 2.6;
const PRESS_END = 0.25;
const DRAG_END = 1.5;
const HOLD_END = 2.2;

/** Where the drag stands at `time`. `t` = 0 to 1 along the line; `alpha` fades the whole mark; `done` = the line is complete. */
export interface GestureState { x: number; y: number; t: number; alpha: number; done: boolean }

export function gestureAt(g: Gesture, time: number, out: GestureState): GestureState {
  const phase = ((time % GESTURE_PERIOD) + GESTURE_PERIOD) % GESTURE_PERIOD;
  const drag = Math.min(1, Math.max(0, (phase - PRESS_END) / (DRAG_END - PRESS_END)));
  out.t = drag * drag * (3 - 2 * drag);
  out.x = g.from.x + (g.to.x - g.from.x) * out.t;
  out.y = g.from.y + (g.to.y - g.from.y) * out.t;
  out.done = phase >= DRAG_END;
  out.alpha = phase < HOLD_END ? 1 : 1 - (phase - HOLD_END) / (GESTURE_PERIOD - HOLD_END);
  return out;
}

/** The radius of a circle gesture at state `s`: from its centre to the cursor. */
export function gestureRadius(g: Gesture, s: GestureState): number {
  return Math.hypot(s.x - g.from.x, s.y - g.from.y);
}

/** A right-drag the player is making: its shape and where it was pressed. */
export interface PlayerDrag { shape: Gesture["shape"]; x: number; y: number }

/** A press this far outside the acted-out drag still counts as the player taking it up. World units. */
const TAKE_MARGIN = 150;

/**
 * True when the player's drag is the one `g` shows, pressed in the right place: then the acted-out drag hides.
 * A line: pressed near the line. A circle: pressed inside the circle it shows.
 */
export function gestureTaken(g: Gesture, drag: PlayerDrag | null): boolean {
  if (!drag || drag.shape !== g.shape) return false;
  const span = Math.hypot(g.to.x - g.from.x, g.to.y - g.from.y);
  const centre = g.shape === "line" ? { x: (g.from.x + g.to.x) / 2, y: (g.from.y + g.to.y) / 2 } : g.from;
  const reach = (g.shape === "line" ? span / 2 : span) + TAKE_MARGIN;
  return Math.hypot(drag.x - centre.x, drag.y - centre.y) <= reach;
}

/** The `n` slots a drag of `g` spreads units over, evenly from end to end. */
export function gestureSlots(g: Gesture, n: number): { x: number; y: number }[] {
  return Array.from({ length: n }, (_, i) => {
    const t = n === 1 ? 0.5 : i / (n - 1);
    return { x: g.from.x + (g.to.x - g.from.x) * t, y: g.from.y + (g.to.y - g.from.y) * t };
  });
}
