// The rings the cursor draws on the ground. Pure.
import { brushWeight, type DabPreview, type Point } from "@mf/map";
import type { Settings } from "./settings.ts";

export type RingKind = "brush" | "profile" | "add" | "remove" | "density";

export interface Ring {
  x: number;
  y: number;
  radius: number;
  kind: RingKind;
  /** 0..1. */
  alpha: number;
}

/** Inner rings at these shares of the radius trace the falloff. */
const PROFILE = [0.2, 0.4, 0.6, 0.8];
/** The centre mark, in screen pixels. The OS pointer is hidden over the canvas, so this is the pointer. */
const DOT_PX = 3;
/** Density dots, in screen pixels. */
const DENSITY_DOT_PX = 2;
/** Past this many dots in one brush the grid is a blur: it is not drawn. */
const MAX_DENSITY_DOTS = 600;

/**
 * At each copy point: the brush edge and a centre mark. Height and paint tools add inner rings whose brightness
 * is the dab's strength there, so the cursor shows falloff and strength. Scatter adds a grid of dots at its
 * density. Then the outlines of what a press would place or erase. `pixel`: world units per screen pixel.
 */
export function cursorRings(points: readonly Point[], radius: number, s: Settings, preview: DabPreview | null, pixel: number): Ring[] {
  const out: Ring[] = [];
  for (const p of points) {
    out.push({ x: p.x, y: p.y, radius, kind: "brush", alpha: 1 }, { x: p.x, y: p.y, radius: pixel * DOT_PX, kind: "brush", alpha: 1 });
    if (paints(s)) for (const f of PROFILE) out.push({ x: p.x, y: p.y, radius: radius * f, kind: "profile", alpha: s.strength * brushWeight(radius * f, radius, s.falloff) });
    if (scatters(s)) out.push(...densityDots(p, radius, s.density, pixel * DENSITY_DOT_PX));
  }
  for (const d of preview?.add ?? []) out.push({ ...d, kind: "add", alpha: 1 });
  for (const d of preview?.remove ?? []) out.push({ ...d, kind: "remove", alpha: 1 });
  return out;
}

/** A hex grid inside the brush, one dot per `1e6 / density` square units: the spacing a scatter aims for. */
function densityDots(c: Point, radius: number, density: number, dot: number): Ring[] {
  if ((Math.PI * radius * radius * density) / 1e6 > MAX_DENSITY_DOTS) return [];
  const step = Math.sqrt(2e6 / (Math.sqrt(3) * density));
  const rowStep = (step * Math.sqrt(3)) / 2;
  const out: Ring[] = [];
  for (let row = Math.floor(-radius / rowStep); row * rowStep <= radius; row++) {
    const dy = row * rowStep;
    const shift = row % 2 === 0 ? 0 : step / 2;
    for (let dx = Math.floor(-radius / step) * step + shift; dx <= radius; dx += step) {
      if (dx * dx + dy * dy < radius * radius) out.push({ x: c.x + dx, y: c.y + dy, radius: dot, kind: "density", alpha: 1 });
    }
  }
  return out;
}

function paints(s: Settings): boolean {
  return s.tool !== "feature" && s.tool !== "field";
}

function scatters(s: Settings): boolean {
  return s.tool === "feature" && s.featureMode === "scatter";
}
