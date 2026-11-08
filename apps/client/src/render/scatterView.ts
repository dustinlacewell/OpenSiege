/** Scatter nearer the camera than the fade start is full size. */
const FADE_START = 0.6;
/** The fade distance follows the zoom, within these bounds, in world units. */
const MIN_END = 1200;
const MAX_END = 3200;
const END_PER_DIST = 1.4;
/** The window is rebuilt only when the camera crosses to a new block of this size. */
const SNAP = 500;
/** Extra window radius so the camera can drift half a block before a rebuild shows a gap. */
const MARGIN = 400;

/** Where scatter is built and where it fades. */
export interface ScatterView {
  /** Window centre, on the snap grid. */
  cx: number;
  cy: number;
  /** Cells within this distance of the centre get scatter. */
  buildRadius: number;
  /** Distance from the camera target where scatter has shrunk to nothing. */
  fadeEnd: number;
}

/**
 * The scatter window for a camera looking at (x, y) from `dist`. Snapped, so it stays equal for many
 * frames of panning; the fade itself follows the true camera each frame.
 */
export function scatterView(x: number, y: number, dist: number): ScatterView {
  const fadeEnd = Math.ceil(Math.min(MAX_END, Math.max(MIN_END, dist * END_PER_DIST)) / SNAP) * SNAP;
  return { cx: Math.round(x / SNAP) * SNAP, cy: Math.round(y / SNAP) * SNAP, buildRadius: fadeEnd + MARGIN, fadeEnd };
}

/** Zoomed out past this camera distance a tuft is under a pixel: nothing is built or drawn. */
export function scatterVisible(dist: number): boolean {
  return dist <= 7000;
}

export function sameView(a: ScatterView, b: ScatterView): boolean {
  return a.cx === b.cx && a.cy === b.cy && a.fadeEnd === b.fadeEnd;
}

export function fadeStart(v: ScatterView): number {
  return v.fadeEnd * FADE_START;
}
