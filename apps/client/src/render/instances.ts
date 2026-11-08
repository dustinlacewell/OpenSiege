export interface Attribute {
  location: number;
  size: number;
}

/**
 * One growing Float32Array of per-instance (or per-vertex, with divisor 0) data and its GL buffer.
 * The array and the buffer only grow; each frame uploads the used part with bufferSubData.
 */
export class InstanceBuffer {
  data: Float32Array;
  count = 0;
  private readonly buffer: WebGLBuffer;
  private gpuCapacity = 0;

  constructor(private readonly gl: WebGL2RenderingContext, readonly stride: number, capacity = 256) {
    this.data = new Float32Array(stride * capacity);
    this.buffer = gl.createBuffer();
  }

  reset(): void {
    this.count = 0;
  }

  /** Returns the float offset of a new instance slot. */
  push(): number {
    const offset = this.count * this.stride;
    if (offset + this.stride > this.data.length) this.grow();
    this.count++;
    return offset;
  }

  upload(): void {
    const gl = this.gl;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
    if (this.gpuCapacity < this.data.length) {
      gl.bufferData(gl.ARRAY_BUFFER, this.data.byteLength, gl.DYNAMIC_DRAW);
      this.gpuCapacity = this.data.length;
    }
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.data, 0, this.count * this.stride);
  }

  /** Binds the attributes, in order, into the currently bound VAO. */
  bindAttributes(attributes: readonly Attribute[], divisor = 1): void {
    const gl = this.gl;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
    let offset = 0;
    for (const a of attributes) {
      gl.enableVertexAttribArray(a.location);
      gl.vertexAttribPointer(a.location, a.size, gl.FLOAT, false, this.stride * 4, offset * 4);
      gl.vertexAttribDivisor(a.location, divisor);
      offset += a.size;
    }
  }

  private grow(): void {
    const next = new Float32Array(this.data.length * 2);
    next.set(this.data);
    this.data = next;
  }
}

/** Binds the shared unit quad as attribute 0 of the current VAO. */
export function bindQuad(gl: WebGL2RenderingContext, quad: WebGLBuffer): void {
  gl.bindBuffer(gl.ARRAY_BUFFER, quad);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
}
