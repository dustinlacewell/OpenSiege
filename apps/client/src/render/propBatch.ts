import { staticBuffer, vertexLayout } from "./gl.ts";
import { InstanceBuffer } from "./instances.ts";
import { VERTEX_FLOATS } from "./meshBuilder.ts";
import { PROP_STRIDE } from "./propInstance.ts";

/** One static model and its instances: filled by the owner, uploaded, drawn by `PropProgram`. */
export class PropBatch {
  readonly instances: InstanceBuffer;
  private readonly vao: WebGLVertexArrayObject;
  private readonly vertexCount: number;

  constructor(private readonly gl: WebGL2RenderingContext, vertices: Float32Array, capacity = 64) {
    this.instances = new InstanceBuffer(gl, PROP_STRIDE, capacity);
    this.vertexCount = vertices.length / VERTEX_FLOATS;
    this.vao = gl.createVertexArray();
    gl.bindVertexArray(this.vao);
    staticBuffer(gl, gl.ARRAY_BUFFER, vertices);
    vertexLayout(gl, [3, 3, 1]);
    this.instances.bindAttributes([
      { location: 3, size: 4 },
      { location: 4, size: 3 },
    ]);
    gl.bindVertexArray(null);
  }

  /** Sends the instances written since the last `instances.reset()`. */
  upload(): void {
    if (this.instances.count > 0) this.instances.upload();
  }

  draw(): void {
    if (this.instances.count === 0) return;
    this.gl.bindVertexArray(this.vao);
    this.gl.drawArraysInstanced(this.gl.TRIANGLES, 0, this.vertexCount, this.instances.count);
  }
}
