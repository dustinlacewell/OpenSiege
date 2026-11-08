import { FLOATS_PER_LIGHT, MAX_LIGHTS } from "../game/lights.ts";

/** Tile edge in pixels. The lit shaders find their tile as gl_FragCoord / LIGHT_TILE. */
export const LIGHT_TILE = 32;
/** Most lights one tile keeps. Lights come strongest first, so the weakest drop. */
export const MAX_PER_TILE = 64;
/** Index list entries per row of its texture. */
export const LIGHT_INDEX_ROW = 1024;
/** Most entries in the index list in one frame. */
export const LIGHT_INDEX_CAPACITY = 32 * LIGHT_INDEX_ROW;

/** Clip w at or below this counts as at or behind the eye. */
const NEAR_W = 1e-3;

/**
 * Bins packed lights into screen tiles. Pure: no GL. Pixel space is the one of gl_FragCoord in the target:
 * x from the left, y from the bottom, tile (0, 0) at the bottom left.
 */
export class LightTiles {
  tilesX = 0;
  tilesY = 0;
  /** Per tile, row by row from the bottom: (offset into `indices`, count). */
  tiles = new Uint32Array(2);
  /** Light numbers per tile, each tile's run strongest first. */
  readonly indices = new Uint32Array(LIGHT_INDEX_CAPACITY);
  indexCount = 0;
  /** Per light: tile rect x0, y0, x1, y1 (inclusive), or x0 > x1 when it covers no tile. */
  private readonly rects = new Int32Array(MAX_LIGHTS * 4);
  /** Per tile: the light count while counting, then the write cursor while filling. */
  private cursor = new Uint32Array(1);
  private readonly corner = new Float64Array(4);

  /** Bins `count` lights of `data` (FLOATS_PER_LIGHT each, strongest first) for a width x height target. */
  bin(data: Float32Array, count: number, viewProj: Float32Array, width: number, height: number): void {
    this.fit(width, height);
    const n = Math.min(count, MAX_LIGHTS);
    for (let i = 0; i < n; i++) this.rectOf(data, i, viewProj, width, height);
    this.countPerTile(n);
    this.assignOffsets();
    this.fillIndices(n);
  }

  /** Resizes the tile grid. Allocates only when the tile count changes. */
  private fit(width: number, height: number): void {
    this.tilesX = Math.max(1, Math.ceil(width / LIGHT_TILE));
    this.tilesY = Math.max(1, Math.ceil(height / LIGHT_TILE));
    const size = this.tilesX * this.tilesY;
    if (this.cursor.length !== size) {
      this.cursor = new Uint32Array(size);
      this.tiles = new Uint32Array(size * 2);
    } else this.cursor.fill(0);
  }

  /** Conservative tile rect of light i: the screen box of the world box around its bounding sphere. */
  private rectOf(data: Float32Array, i: number, m: Float32Array, width: number, height: number): void {
    const o = i * FLOATS_PER_LIGHT;
    const hx = (data[o + 4]! - data[o]!) / 2, hy = (data[o + 5]! - data[o + 1]!) / 2, hz = (data[o + 6]! - data[o + 2]!) / 2;
    const cx = data[o]! + hx, cy = data[o + 1]! + hy, cz = data[o + 2]! + hz;
    const r = data[o + 3]! + Math.hypot(hx, hy, hz);
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (let k = 0; k < 8; k++) {
      const p = this.project(m, cx + (k & 1 ? r : -r), cy + (k & 2 ? r : -r), cz + (k & 4 ? r : -r));
      if (p[3]! <= NEAR_W) return this.setRect(i, 0, 0, this.tilesX - 1, this.tilesY - 1);
      const px = (p[0]! / p[3]! * 0.5 + 0.5) * width;
      const py = (p[1]! / p[3]! * 0.5 + 0.5) * height;
      minX = Math.min(minX, px); maxX = Math.max(maxX, px);
      minY = Math.min(minY, py); maxY = Math.max(maxY, py);
    }
    if (maxX < 0 || maxY < 0 || minX >= width || minY >= height) return this.setRect(i, 1, 0, 0, 0);
    this.setRect(i, this.tileOf(minX, this.tilesX), this.tileOf(minY, this.tilesY), this.tileOf(maxX, this.tilesX), this.tileOf(maxY, this.tilesY));
  }

  private project(m: Float32Array, x: number, y: number, z: number): Float64Array {
    const c = this.corner;
    c[0] = m[0]! * x + m[4]! * y + m[8]! * z + m[12]!;
    c[1] = m[1]! * x + m[5]! * y + m[9]! * z + m[13]!;
    c[3] = m[3]! * x + m[7]! * y + m[11]! * z + m[15]!;
    return c;
  }

  private tileOf(px: number, tiles: number): number {
    return Math.min(tiles - 1, Math.max(0, Math.floor(px / LIGHT_TILE)));
  }

  private setRect(i: number, x0: number, y0: number, x1: number, y1: number): void {
    const r = this.rects;
    r[i * 4] = x0; r[i * 4 + 1] = y0; r[i * 4 + 2] = x1; r[i * 4 + 3] = y1;
  }

  /** Counts each tile's lights, capped at MAX_PER_TILE. */
  private countPerTile(n: number): void {
    const c = this.cursor, r = this.rects, w = this.tilesX;
    for (let i = 0; i < n; i++) {
      for (let y = r[i * 4 + 1]!; y <= r[i * 4 + 3]!; y++) {
        for (let x = r[i * 4]!; x <= r[i * 4 + 2]!; x++) {
          const tile = y * w + x;
          if (c[tile]! < MAX_PER_TILE) c[tile] = c[tile]! + 1;
        }
      }
    }
  }

  /** Prefix sum of the counts into offsets. A tile past the capacity keeps only what fits. Resets the cursors. */
  private assignOffsets(): void {
    const t = this.tiles, c = this.cursor;
    let offset = 0;
    for (let tile = 0; tile < c.length; tile++) {
      const count = Math.min(c[tile]!, LIGHT_INDEX_CAPACITY - offset);
      t[tile * 2] = offset;
      t[tile * 2 + 1] = count;
      c[tile] = 0;
      offset += count;
    }
    this.indexCount = offset;
  }

  /** Writes light numbers into each tile's run in light order, until the run is full. */
  private fillIndices(n: number): void {
    const t = this.tiles, c = this.cursor, r = this.rects, w = this.tilesX;
    for (let i = 0; i < n; i++) {
      for (let y = r[i * 4 + 1]!; y <= r[i * 4 + 3]!; y++) {
        for (let x = r[i * 4]!; x <= r[i * 4 + 2]!; x++) {
          const tile = y * w + x;
          const k = c[tile]!;
          if (k >= t[tile * 2 + 1]!) continue;
          this.indices[t[tile * 2]! + k] = i;
          c[tile] = k + 1;
        }
      }
    }
  }
}
