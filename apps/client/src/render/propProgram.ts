import { createProgram, uniform } from "./gl.ts";
import { opaque } from "./glState.ts";
import type { PropBatch } from "./propBatch.ts";
import { PROP_FS, PROP_VS } from "./propShader.ts";
import { applyScene, sceneUniforms, type SceneLights, type SceneUniforms, type SceneView, type SunLight } from "./scene.ts";
import { DEPTH_FS } from "./shadowMap.ts";

/** Props shrink to nothing between `start` and `end` world units from (x, y). */
export interface Fade {
  x: number;
  y: number;
  start: number;
  end: number;
}

/** Never shrinks anything on the map. */
export const NO_FADE: Fade = { x: 0, y: 0, start: 1e9, end: 2e9 };

/** The programs for static props, lit and depth. Feature and scatter passes share one. */
export class PropProgram {
  private readonly program: WebGLProgram;
  private readonly scene: SceneUniforms;
  private readonly fade: WebGLUniformLocation | null;
  private readonly depthProgram: WebGLProgram;
  private readonly depthViewProj: WebGLUniformLocation | null;
  private readonly depthFade: WebGLUniformLocation | null;

  constructor(private readonly gl: WebGL2RenderingContext) {
    this.program = createProgram(gl, PROP_VS, PROP_FS);
    this.scene = sceneUniforms(gl, this.program);
    this.fade = uniform(gl, this.program, "u_fade");
    this.depthProgram = createProgram(gl, PROP_VS, DEPTH_FS);
    this.depthViewProj = uniform(gl, this.depthProgram, "u_viewProj");
    this.depthFade = uniform(gl, this.depthProgram, "u_fade");
  }

  draw(batches: readonly PropBatch[], cam: SceneView, sun: SunLight, lights: SceneLights, fade: Fade): void {
    const gl = this.gl;
    opaque(gl);
    gl.useProgram(this.program);
    applyScene(gl, this.scene, cam, sun, lights);
    gl.uniform4f(this.fade, fade.x, fade.y, fade.start, fade.end);
    for (const b of batches) b.draw();
    gl.bindVertexArray(null);
  }

  /** Into the bound shadow map. */
  drawDepth(batches: readonly PropBatch[], lightViewProj: Float32Array, fade: Fade): void {
    const gl = this.gl;
    gl.useProgram(this.depthProgram);
    gl.uniformMatrix4fv(this.depthViewProj, false, lightViewProj);
    gl.uniform4f(this.depthFade, fade.x, fade.y, fade.start, fade.end);
    for (const b of batches) b.draw();
    gl.bindVertexArray(null);
  }
}
