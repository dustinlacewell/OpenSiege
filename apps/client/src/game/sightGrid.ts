import { heightAt, type Terrain, type VertexBox } from "@mf/sim";

/** A cell counts as seen when a point this high above its centre is in line of sight. Shells, sparks and smoke sit about here. */
const POINT_Z = 40;

/**
 * Which terrain cells the local player has line of sight to now. One byte per cell, 1 = seen, row-major `j * cols + i`.
 * One cell per sim terrain cell; the grid follows the terrain it is given, square or not.
 * `mark` casts rays from a viewer to the edge of its sight square and keeps a running highest slope:
 * a cell is seen when its point rises above every slope before it on the ray.
 */
export class SightGrid {
  cols = 0;
  rows = 0;
  seen = new Uint8Array(0);
  /** Ground height at each cell centre, from the sim's `heightAt`. */
  private ground = new Float32Array(0);
  private cell = 1;
  private terrain: Terrain | null = null;

  /** Caches cell heights for this terrain. Cheap when the terrain did not change; reallocates when its size did. */
  useTerrain(terrain: Terrain): void {
    if (terrain === this.terrain) return;
    this.terrain = terrain;
    const cols = terrain.cols - 1, rows = terrain.rows - 1;
    if (cols !== this.cols || rows !== this.rows) {
      this.cols = cols;
      this.rows = rows;
      this.seen = new Uint8Array(cols * rows);
      this.ground = new Float32Array(cols * rows);
    }
    this.cell = terrain.cell;
    this.fillGround(terrain, 0, cols - 1, 0, rows - 1);
  }

  /** The heights in this vertex box changed in place: re-read the cells that touch it. Needs `useTerrain` first. */
  refresh(terrain: Terrain, box: VertexBox): void {
    if (terrain !== this.terrain) return;
    const i0 = Math.max(0, box.i0 - 1), i1 = Math.min(this.cols - 1, box.i1);
    const j0 = Math.max(0, box.j0 - 1), j1 = Math.min(this.rows - 1, box.j1);
    this.fillGround(terrain, i0, i1, j0, j1);
  }

  /** Ground height at the centre of each cell in the inclusive cell range. */
  private fillGround(terrain: Terrain, i0: number, i1: number, j0: number, j1: number): void {
    const c = terrain.cell;
    for (let j = j0; j <= j1; j++) {
      for (let i = i0; i <= i1; i++) this.ground[j * this.cols + i] = heightAt(terrain, (i + 0.5) * c, (j + 0.5) * c);
    }
  }

  /** Clears to nothing seen, or to all seen. */
  fill(all: boolean): void {
    this.seen.fill(all ? 1 : 0);
  }

  /** Is the cell under this world point seen? */
  sees(x: number, y: number): boolean {
    return this.seen[this.col(y, this.rows) * this.cols + this.col(x, this.cols)] === 1;
  }

  /** Marks what a viewer at (x, y) with its eye at height `eye` sees within `sight` world units. */
  mark(x: number, y: number, eye: number, sight: number): void {
    const vi = this.col(x, this.cols), vj = this.col(y, this.rows);
    const r = Math.ceil(sight / this.cell);
    this.seen[vj * this.cols + vi] = 1;
    for (let d = -r; d <= r; d++) {
      this.ray(x, y, eye, sight, vi, vj, d, -r, r);
      this.ray(x, y, eye, sight, vi, vj, d, r, r);
      this.ray(x, y, eye, sight, vi, vj, -r, d, r);
      this.ray(x, y, eye, sight, vi, vj, r, d, r);
    }
  }

  /** One ray from the viewer's cell towards cell offset (di, dj), in `steps` cell steps. */
  private ray(x: number, y: number, eye: number, sight: number, vi: number, vj: number, di: number, dj: number, steps: number): void {
    const { cols, rows, cell } = this;
    let highest = -Infinity;
    for (let s = 1; s <= steps; s++) {
      const i = vi + Math.round((di * s) / steps);
      const j = vj + Math.round((dj * s) / steps);
      if (i < 0 || j < 0 || i >= cols || j >= rows) return;
      const ex = (i + 0.5) * cell - x, ey = (j + 0.5) * cell - y;
      const dist = Math.sqrt(ex * ex + ey * ey);
      if (dist > sight) return;
      const k = j * cols + i;
      const z = this.ground[k]!;
      if ((z + POINT_Z - eye) / dist >= highest) this.seen[k] = 1;
      const slope = (z - eye) / dist;
      if (slope > highest) highest = slope;
    }
  }

  /** The cell index along one axis of `n` cells, clamped onto the grid. */
  private col(v: number, n: number): number {
    return Math.min(n - 1, Math.max(0, Math.floor(v / this.cell)));
  }
}
