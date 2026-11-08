// Pure height shapes for multi-level maps. Each returns a height contribution; combine with `Math.max`.
// Passable slopes: the sim blocks a cell whose corner heights differ by more than 38% of the cell (a diagonal counts),
// so a ramp should stay under about 20% and a cliff is any step over one cell that is far steeper.
import { noise, smooth, type Pt, type Scatter, type Size } from "./gen.ts";

/** A flat-topped disc of height `top`: full out to `radius`, then a steep edge `edge` units wide. */
export const plateau = (x: number, y: number, [cx, cy]: Pt, radius: number, top: number, edge = 140): number =>
  top * (1 - smooth((Math.hypot(x - cx, y - cy) - radius) / edge));

/** A straight ramp from height `ha` at `a` to `hb` at `b`, `half` units either side, with steep banks `edge` wide. Past `b` it holds `hb`. */
export function ramp(x: number, y: number, [ax, ay]: Pt, [bx, by]: Pt, ha: number, hb: number, half: number, edge = 160): number {
  const dx = bx - ax, dy = by - ay, t = Math.min(1, Math.max(0, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy)));
  const d = Math.hypot(x - (ax + t * dx), y - (ay + t * dy));
  return (ha + (hb - ha) * t) * (1 - smooth((d - half) / edge));
}

/** Point at `angle` degrees and `radius` from `centre`. */
export const polar = ([cx, cy]: Pt, radius: number, angle: number): Pt => [Math.round(cx + radius * Math.cos((angle * Math.PI) / 180)), Math.round(cy + radius * Math.sin((angle * Math.PI) / 180))];

/** Local relief: 1 outside every disc in `pts`, falling to 0 inside `inner`. Multiply noise by it to keep spots flat. */
export const calmNear = (x: number, y: number, pts: Pt[], inner: number, outer: number): number =>
  Math.min(1, ...pts.map(([px, py]) => smooth((Math.hypot(x - px, y - py) - inner) / (outer - inner))));

/** Forest brushes on the lattice points where a coarse noise is high. */
export function forestBrushes({ W, H }: Size, step: number, scale: number, threshold: number, radius: number, density: number): Scatter[] {
  const out: Scatter[] = [];
  for (let x = step / 2; x < W; x += step) for (let y = step / 2; y < H; y += step) {
    if (noise(x, y, scale) > threshold) out.push({ kind: "tree", x, y, radius, density });
  }
  return out;
}
