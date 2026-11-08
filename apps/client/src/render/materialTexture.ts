/** A rectangle of grid vertices, bounds inclusive (the shape `dirtyBounds` returns in `@mf/map`). */
export interface VertexRect {
  i0: number;
  j0: number;
  i1: number;
  j1: number;
}

/** The texels one `texSubImage2D` call writes: offset and size in the texture, and the row stride of the source. */
export interface RectUpload {
  x: number;
  y: number;
  width: number;
  height: number;
  rowLength: number;
}

/** The per-vertex material weight map on the GPU. `weights` is laid out `(j * cols + i) * 4 + channel`. */
export interface MaterialTexture {
  texture: WebGLTexture;
  upload(weights: Uint8Array): void;
  uploadRect(weights: Uint8Array, rect: VertexRect): void;
  dispose(): void;
}

/** Clamps an inclusive vertex rectangle to the grid. Null when nothing is left to upload. */
export function rectUploadPlan(cols: number, rows: number, rect: VertexRect): RectUpload | null {
  const x0 = Math.max(0, Math.floor(rect.i0));
  const y0 = Math.max(0, Math.floor(rect.j0));
  const x1 = Math.min(cols - 1, Math.floor(rect.i1));
  const y1 = Math.min(rows - 1, Math.floor(rect.j1));
  if (x1 < x0 || y1 < y0) return null;
  return { x: x0, y: y0, width: x1 - x0 + 1, height: y1 - y0 + 1, rowLength: cols };
}

/** One RGBA8 texel per terrain vertex, linear filtered and clamped at the edge. */
export function createMaterialTexture(gl: WebGL2RenderingContext, cols: number, rows: number): MaterialTexture {
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA8, cols, rows);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.bindTexture(gl.TEXTURE_2D, null);
  const write = (weights: Uint8Array, plan: RectUpload): void => writeRect(gl, texture, weights, plan);
  return {
    texture,
    upload: (weights) => write(weights, { x: 0, y: 0, width: cols, height: rows, rowLength: cols }),
    uploadRect: (weights, rect) => {
      const plan = rectUploadPlan(cols, rows, rect);
      if (plan) write(weights, plan);
    },
    dispose: () => gl.deleteTexture(texture),
  };
}

/** Uploads one rectangle straight out of the full weight array; the unpack state picks its rows. */
function writeRect(gl: WebGL2RenderingContext, texture: WebGLTexture, weights: Uint8Array, p: RectUpload): void {
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
  gl.pixelStorei(gl.UNPACK_ROW_LENGTH, p.rowLength);
  gl.pixelStorei(gl.UNPACK_SKIP_PIXELS, p.x);
  gl.pixelStorei(gl.UNPACK_SKIP_ROWS, p.y);
  gl.texSubImage2D(gl.TEXTURE_2D, 0, p.x, p.y, p.width, p.height, gl.RGBA, gl.UNSIGNED_BYTE, weights);
  gl.pixelStorei(gl.UNPACK_ROW_LENGTH, 0);
  gl.pixelStorei(gl.UNPACK_SKIP_PIXELS, 0);
  gl.pixelStorei(gl.UNPACK_SKIP_ROWS, 0);
  gl.bindTexture(gl.TEXTURE_2D, null);
}
