import type { Terrain, VertexBox } from "@mf/sim";
import { rectUploadPlan, type RectUpload } from "./materialTexture.ts";

/** Copies the vertex heights of `plan` from the sim's row-major array into the same places in `out`. Pure. */
export function copyHeightRect(heights: readonly number[], plan: RectUpload, out: Float32Array): void {
  const cols = plan.rowLength;
  for (let j = plan.y; j < plan.y + plan.height; j++) {
    for (let i = plan.x; i < plan.x + plan.width; i++) out[j * cols + i] = heights[j * cols + i]!;
  }
}

/**
 * The sim's vertex heights on the GPU: one R16F texel per vertex, `cols` by `rows`, linear filtered.
 * Vertex (i, j) is texel centre (i, j). Mirrored wrap; the shader folds world xy onto the map first, so the
 * mirrored surround reads the heights it copies.
 */
export class GroundHeightTexture {
  private tex: WebGLTexture | null = null;
  private source: Terrain | null = null;
  private cpu = new Float32Array(0);
  private cols = 0;
  private rows = 0;

  constructor(private readonly gl: WebGL2RenderingContext) {}

  /** Null until the first `sync`. */
  get texture(): WebGLTexture | null {
    return this.tex;
  }

  /** Call before a draw. A new terrain object uploads every height. */
  sync(terrain: Terrain): void {
    if (terrain === this.source) return;
    this.source = terrain;
    this.allocate(terrain.cols, terrain.rows);
    this.update(terrain, { i0: 0, j0: 0, i1: terrain.cols - 1, j1: terrain.rows - 1 });
  }

  /** The heights in `box` changed in place: upload only that rectangle. */
  update(terrain: Terrain, box: VertexBox): void {
    if (terrain !== this.source) return this.sync(terrain);
    const plan = rectUploadPlan(this.cols, this.rows, box);
    if (!plan) return;
    copyHeightRect(terrain.heights, plan, this.cpu);
    this.write(plan);
  }

  /** A fresh texture object each time, since texStorage2D storage is immutable. */
  private allocate(cols: number, rows: number): void {
    const gl = this.gl;
    this.cols = cols;
    this.rows = rows;
    this.cpu = new Float32Array(cols * rows);
    if (this.tex) gl.deleteTexture(this.tex);
    this.tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.texStorage2D(gl.TEXTURE_2D, 1, gl.R16F, cols, rows);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.MIRRORED_REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.MIRRORED_REPEAT);
    gl.bindTexture(gl.TEXTURE_2D, null);
  }

  private write(p: RectUpload): void {
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
    gl.pixelStorei(gl.UNPACK_ROW_LENGTH, p.rowLength);
    gl.pixelStorei(gl.UNPACK_SKIP_PIXELS, p.x);
    gl.pixelStorei(gl.UNPACK_SKIP_ROWS, p.y);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, p.x, p.y, p.width, p.height, gl.RED, gl.FLOAT, this.cpu);
    gl.pixelStorei(gl.UNPACK_ROW_LENGTH, 0);
    gl.pixelStorei(gl.UNPACK_SKIP_PIXELS, 0);
    gl.pixelStorei(gl.UNPACK_SKIP_ROWS, 0);
    gl.bindTexture(gl.TEXTURE_2D, null);
  }
}
