import { heightAt, type Terrain } from "@mf/sim";
import type { LineSink, LineStyle } from "../game/groundLines.ts";

const SEGMENTS = 96;
const LIFT = 8;

/** A dashed circle draped over the terrain: every other segment of a SEGMENTS-sided polygon. */
export function rangeCircle(sink: LineSink, t: Terrain, x: number, y: number, radius: number, style: LineStyle): void {
  for (let i = 0; i < SEGMENTS; i += 2) {
    const a0 = (i / SEGMENTS) * Math.PI * 2;
    const a1 = ((i + 1) / SEGMENTS) * Math.PI * 2;
    const x0 = x + Math.cos(a0) * radius, y0 = y + Math.sin(a0) * radius;
    const x1 = x + Math.cos(a1) * radius, y1 = y + Math.sin(a1) * radius;
    sink.segment(x0, y0, heightAt(t, x0, y0) + LIFT, x1, y1, heightAt(t, x1, y1) + LIFT, style, 1, 1);
  }
}
