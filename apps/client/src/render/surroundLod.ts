// Index lists for the mirrored surround's detail levels. Pure.

/** Vertex step for ring `r` (1 = the ring touching the map): halves the detail each ring out, down to 1 in 16. */
export function strideForRing(r: number): number {
  return Math.min(16, 2 ** r);
}

/**
 * Triangles over a `cols` by `rows` vertex grid that use every `stride`-th vertex inside and every vertex on the
 * border. A strip joins the coarse inside to the full border, so any two tiles meet edge to edge with no crack,
 * whatever their strides. Falls back to the full grid when the map is too small for the stride.
 */
export function lodIndices(cols: number, rows: number, stride: number): Uint32Array {
  const xs = innerSamples(cols, stride);
  const ys = innerSamples(rows, stride);
  if (stride <= 1 || xs.length < 2 || ys.length < 2) return gridTriangles(cols, range(cols), range(rows));
  const out: number[] = [];
  gridInto(out, cols, xs, ys);
  stitchBorder(out, cols, rows, xs, ys);
  return Uint32Array.from(out);
}

/** Multiples of `stride` strictly inside `0..n-1`, so a full-detail border row is left on each side. */
function innerSamples(n: number, stride: number): number[] {
  const out: number[] = [];
  for (let k = stride; k < n - 1; k += stride) out.push(k);
  return out;
}

function range(n: number): number[] {
  return Array.from({ length: n }, (_, k) => k);
}

function gridTriangles(cols: number, xs: readonly number[], ys: readonly number[]): Uint32Array {
  const out: number[] = [];
  gridInto(out, cols, xs, ys);
  return Uint32Array.from(out);
}

/** Two triangles per cell of the sampled grid. */
function gridInto(out: number[], cols: number, xs: readonly number[], ys: readonly number[]): void {
  for (let b = 0; b + 1 < ys.length; b++) {
    for (let a = 0; a + 1 < xs.length; a++) {
      const p = ys[b]! * cols + xs[a]!, q = ys[b]! * cols + xs[a + 1]!;
      const r = ys[b + 1]! * cols + xs[a]!, s = ys[b + 1]! * cols + xs[a + 1]!;
      out.push(p, r, q, q, r, s);
    }
  }
}

/**
 * The band between the grid's border (every vertex) and the coarse inside's outline, one side at a time.
 * Each side runs corner to corner on both outlines, so the four bands share their end edges.
 */
function stitchBorder(out: number[], cols: number, rows: number, xs: readonly number[], ys: readonly number[]): void {
  const id = (i: number, j: number): number => j * cols + i;
  const x0 = xs[0]!, x1 = xs[xs.length - 1]!, y0 = ys[0]!, y1 = ys[ys.length - 1]!;
  const all = (n: number): number[] => range(n);
  const rev = (a: readonly number[]): number[] => [...a].reverse();
  // Bottom, right, top, left; each pair is (outer, inner) as [index, position along the side].
  const sides: [Array<[number, number]>, Array<[number, number]>][] = [
    [all(cols).map((i) => [id(i, 0), i]), xs.map((i) => [id(i, y0), i])],
    [all(rows).map((j) => [id(cols - 1, j), j]), ys.map((j) => [id(x1, j), j])],
    [rev(all(cols)).map((i) => [id(i, rows - 1), -i]), rev(xs).map((i) => [id(i, y1), -i])],
    [rev(all(rows)).map((j) => [id(0, j), -j]), rev(ys).map((j) => [id(x0, j), -j])],
  ];
  for (const [outer, inner] of sides) zip(out, outer, inner);
}

/** Triangulates between two polylines that run the same way, always advancing the one whose next point comes first. */
function zip(out: number[], a: ReadonlyArray<[number, number]>, b: ReadonlyArray<[number, number]>): void {
  let i = 0, j = 0;
  while (i < a.length - 1 || j < b.length - 1) {
    const takeA = j === b.length - 1 || (i < a.length - 1 && a[i + 1]![1] <= b[j + 1]![1]);
    if (takeA) {
      out.push(a[i]![0], a[i + 1]![0], b[j]![0]);
      i++;
    } else {
      out.push(a[i]![0], b[j + 1]![0], b[j]![0]);
      j++;
    }
  }
}
