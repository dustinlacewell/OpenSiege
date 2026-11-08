/** One triangle that covers the screen, from gl_VertexID alone. `v_ndc` is the clip-space xy. */
export const FULLSCREEN_VS = `#version 300 es
out vec2 v_ndc;
void main() {
  vec2 p = vec2(float((gl_VertexID & 1) << 2) - 1.0, float((gl_VertexID & 2) << 1) - 1.0);
  v_ndc = p;
  gl_Position = vec4(p, 0.0, 1.0);
}
`;

/** An attribute-less VAO and the draw that goes with FULLSCREEN_VS. */
export class FullscreenTriangle {
  private readonly vao: WebGLVertexArrayObject;

  constructor(private readonly gl: WebGL2RenderingContext) {
    this.vao = gl.createVertexArray();
  }

  draw(): void {
    const gl = this.gl;
    gl.bindVertexArray(this.vao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindVertexArray(null);
  }
}
