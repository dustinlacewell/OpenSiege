import type { Bounds } from "./placement.ts";

export interface Point {
  x: number;
  y: number;
}

export type Transform = (p: Point) => Point;

/** Rotational order 1..8 about the map centre. `mirror` adds a reflection of each copy (the kaleidoscope). */
export interface Symmetry {
  order: number;
  mirror: boolean;
}

export const MAX_SYMMETRY = 8;
export const NO_SYMMETRY: Symmetry = { order: 1, mirror: false };

/** Every copy's transform; the first is the identity. On a rectangle some copies fall off the map: callers drop those. */
export function symmetryTransforms(s: Symmetry, map: Bounds): Transform[] {
  const cx = map.width / 2, cy = map.height / 2;
  const order = Math.max(1, Math.min(MAX_SYMMETRY, Math.round(s.order)));
  const out: Transform[] = [];
  for (let k = 0; k < order; k++) {
    const a = (2 * Math.PI * k) / order;
    out.push(rotation(cx, cy, a, false));
    if (s.mirror) out.push(rotation(cx, cy, a, true));
  }
  return out;
}

/**
 * The copies of `p` within `reach` of the map, minus near-duplicates (a point at the centre is one point).
 * `reach` is the brush radius: a brush whose centre is off the map still edits the part that is on it.
 */
export function symmetricPoints(p: Point, transforms: readonly Transform[], map: Bounds, reach = 0): Point[] {
  const out: Point[] = [];
  for (const t of transforms) {
    const q = t(p);
    if (q.x < -reach || q.y < -reach || q.x > map.width + reach || q.y > map.height + reach) continue;
    if (out.some((o) => Math.abs(o.x - q.x) < 1 && Math.abs(o.y - q.y) < 1)) continue;
    out.push(q);
  }
  return out;
}

/** Rotate by `a` about the centre; with `flip`, reflect across the horizontal centre line first. */
function rotation(cx: number, cy: number, a: number, flip: boolean): Transform {
  const c = Math.cos(a), s = Math.sin(a);
  return (p) => {
    const dx = p.x - cx;
    const dy = flip ? cy - p.y : p.y - cy;
    return { x: cx + dx * c - dy * s, y: cy + dx * s + dy * c };
  };
}
