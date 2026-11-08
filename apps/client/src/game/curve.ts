import { MAX_PATH_POINTS, spreadAlong, type MapSize, type PathPoint } from "@mf/sim";

/** World units the cursor must travel on the ground before the stroke takes a new sample. */
const MIN_SAMPLE = 40;

/** A right-drag curve move in progress: the raw ground stroke, the path it sends, and where each unit will go. */
export interface Curve {
  stroke: readonly PathPoint[];
  /** Integer points, at most MAX_PATH_POINTS. The move intent carries exactly these. */
  path: readonly PathPoint[];
  /** The sim's own spread along `path`, one per unit. Empty while `path` has under 2 points. */
  spots: readonly PathPoint[];
}

/** An empty curve. */
export function emptyCurve(): Curve {
  return { stroke: [], path: [], spots: [] };
}

/**
 * The curve with one more ground sample, for `units` units on map `m`. A sample off the map, or
 * closer than MIN_SAMPLE to the last one, leaves the curve as it is.
 */
export function addSample(curve: Curve, x: number, y: number, units: number, m: MapSize): Curve {
  if (x < 0 || y < 0 || x > m.width || y > m.height) return curve;
  const last = curve.stroke[curve.stroke.length - 1];
  if (last && Math.hypot(x - last.x, y - last.y) < MIN_SAMPLE) return curve;
  return withStroke([...curve.stroke, { x, y }], units, m);
}

/** Rebuild the path and spots from a stroke. */
export function withStroke(stroke: readonly PathPoint[], units: number, m: MapSize): Curve {
  const path = resample(stroke, MAX_PATH_POINTS);
  return { stroke, path, spots: path.length >= 2 ? spreadAlong(path, units, m) : [] };
}

/**
 * At most `max` integer points evenly spaced by arc length, ends kept.
 * Equal neighbours after rounding are merged, so 2 or more points always have length.
 */
export function resample(stroke: readonly PathPoint[], max: number): PathPoint[] {
  const picked = stroke.length <= max ? stroke : evenly(stroke, max);
  const out: PathPoint[] = [];
  for (const p of picked) {
    const q = { x: Math.round(p.x), y: Math.round(p.y) };
    const prev = out[out.length - 1];
    if (!prev || prev.x !== q.x || prev.y !== q.y) out.push(q);
  }
  return out;
}

/** `max` points along the stroke at equal arc-length steps, first and last included. */
function evenly(stroke: readonly PathPoint[], max: number): PathPoint[] {
  const cum = [0];
  for (let i = 1; i < stroke.length; i++) cum.push(cum[i - 1]! + Math.hypot(stroke[i]!.x - stroke[i - 1]!.x, stroke[i]!.y - stroke[i - 1]!.y));
  const total = cum[cum.length - 1]!;
  const out: PathPoint[] = [];
  let seg = 1;
  for (let k = 0; k < max; k++) {
    const d = (total * k) / (max - 1);
    while (seg < stroke.length - 1 && cum[seg]! < d) seg++;
    const a = stroke[seg - 1]!, b = stroke[seg]!;
    const len = cum[seg]! - cum[seg - 1]!;
    const t = len > 0 ? Math.min(1, Math.max(0, (d - cum[seg - 1]!) / len)) : 0;
    out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
  }
  return out;
}
