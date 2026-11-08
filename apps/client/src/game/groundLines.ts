import { heightAt, type Terrain } from "@mf/sim";

/** A line colour, its near-end opacity, and its width in CSS pixels. */
export interface LineStyle {
  r: number;
  g: number;
  b: number;
  a: number;
  widthPx: number;
}

/** Receives straight world-space segments. `fadeA`/`fadeB` scale the style's opacity at each end. */
export interface LineSink {
  segment(ax: number, ay: number, az: number, bx: number, by: number, bz: number, style: LineStyle, fadeA: number, fadeB: number): void;
}

const LIFT = 6;
const STEP = 75;
const MAX_STEPS = 48;

/** A ground-hugging polyline from a to b, its opacity falling from 1 to `fadeEnd`. */
export function drape(sink: LineSink, t: Terrain, ax: number, ay: number, bx: number, by: number, style: LineStyle, fadeEnd: number): void {
  const len = Math.hypot(bx - ax, by - ay);
  if (len < 1) return;
  const steps = Math.min(MAX_STEPS, Math.max(1, Math.ceil(len / STEP)));
  let px = ax, py = ay, pz = heightAt(t, ax, ay) + LIFT, pf = 1;
  for (let k = 1; k <= steps; k++) {
    const s = k / steps;
    const x = ax + (bx - ax) * s;
    const y = ay + (by - ay) * s;
    const z = heightAt(t, x, y) + LIFT;
    const f = 1 + (fadeEnd - 1) * s;
    sink.segment(px, py, pz, x, y, z, style, pf, f);
    px = x; py = y; pz = z; pf = f;
  }
}

/** A ground circle of `segments` straight pieces. */
export function ring(sink: LineSink, t: Terrain, x: number, y: number, radius: number, segments: number, style: LineStyle, fade: number): void {
  for (let k = 0; k < segments; k++) {
    const a0 = (k / segments) * Math.PI * 2;
    const a1 = ((k + 1) / segments) * Math.PI * 2;
    groundSegment(sink, t, x + Math.cos(a0) * radius, y + Math.sin(a0) * radius, x + Math.cos(a1) * radius, y + Math.sin(a1) * radius, style, fade);
  }
}

/** An axis-aligned ground square centred on x, y. */
export function square(sink: LineSink, t: Terrain, x: number, y: number, half: number, style: LineStyle, fade: number): void {
  const x0 = x - half, x1 = x + half, y0 = y - half, y1 = y + half;
  groundSegment(sink, t, x0, y0, x1, y0, style, fade);
  groundSegment(sink, t, x1, y0, x1, y1, style, fade);
  groundSegment(sink, t, x1, y1, x0, y1, style, fade);
  groundSegment(sink, t, x0, y1, x0, y0, style, fade);
}

/** The four corners of a ground square centred on x, y, turned by `yaw`; each corner an L whose arms are `arm` long. */
export function brackets(sink: LineSink, t: Terrain, x: number, y: number, half: number, arm: number, yaw: number, style: LineStyle, fade: number): void {
  const c = Math.cos(yaw), s = Math.sin(yaw);
  for (let k = 0; k < 4; k++) {
    const sx = k === 0 || k === 3 ? -1 : 1;
    const sy = k < 2 ? -1 : 1;
    const cx = sx * half, cy = sy * half;
    const ax = cx - sx * arm, ay = cy;
    const bx = cx, by = cy - sy * arm;
    groundSegment(sink, t, x + ax * c - ay * s, y + ax * s + ay * c, x + cx * c - cy * s, y + cx * s + cy * c, style, fade);
    groundSegment(sink, t, x + cx * c - cy * s, y + cx * s + cy * c, x + bx * c - by * s, y + bx * s + by * c, style, fade);
  }
}

function groundSegment(sink: LineSink, t: Terrain, ax: number, ay: number, bx: number, by: number, style: LineStyle, fade: number): void {
  sink.segment(ax, ay, heightAt(t, ax, ay) + LIFT, bx, by, heightAt(t, bx, by) + LIFT, style, fade, fade);
}
