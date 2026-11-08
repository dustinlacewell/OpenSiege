import { mapCentre, type MapSize } from "@mf/sim";

/** A point on the ground plane, world units. */
export interface Point {
  x: number;
  y: number;
}

export function dist2(a: Point, b: Point): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

export function dist(a: Point, b: Point): number {
  return Math.sqrt(dist2(a, b));
}

export function within(a: Point, b: Point, r: number): boolean {
  return dist2(a, b) <= r * r;
}

/** Mean of the points. The map centre for an empty list. */
export function centroid(points: readonly Point[], m: MapSize): Point {
  if (points.length === 0) return mapCentre(m);
  let x = 0;
  let y = 0;
  for (const p of points) {
    x += p.x;
    y += p.y;
  }
  return { x: x / points.length, y: y / points.length };
}

/** The farthest any point lies from `c`. */
export function spread(points: readonly Point[], c: Point): number {
  let worst = 0;
  for (const p of points) worst = Math.max(worst, dist(p, c));
  return worst;
}

/** `from` moved `step` world units toward `to`, kept on the map. Past `to` stops at `to`. */
export function toward(from: Point, to: Point, step: number, m: MapSize): Point {
  const d = dist(from, to);
  if (d <= Math.abs(step) && step > 0) return clampPoint(to, m);
  if (d === 0) return clampPoint(from, m);
  const k = step / d;
  return clampPoint({ x: from.x + (to.x - from.x) * k, y: from.y + (to.y - from.y) * k }, m);
}

/** Rounded and clamped inside the map, with a margin so formations fit. */
export function clampPoint(p: Point, m: MapSize, margin = 200): Point {
  const clamp = (v: number, hi: number): number => Math.round(Math.min(hi - margin, Math.max(margin, v)));
  return { x: clamp(p.x, m.width), y: clamp(p.y, m.height) };
}

/** The point across the map centre. A first guess at where a rival starts. */
export function mirror(p: Point, m: MapSize): Point {
  return { x: m.width - p.x, y: m.height - p.y };
}
