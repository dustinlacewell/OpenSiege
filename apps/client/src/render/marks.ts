import type { Camera } from "../game/camera.ts";
import { createProgram, uniform } from "./gl.ts";
import { bindQuad, InstanceBuffer } from "./instances.ts";
import { MARKS_FS, MARKS_VS } from "./overlayShader.ts";

export type Rgba = readonly [number, number, number, number];

/** x, y, z, kind · four params · rgba. */
const STRIDE = 12;
const RING = 0;
const BAR = 1;

/** The marks shader. Shared by every MarksBatch. */
export class MarksProgram {
  readonly program: WebGLProgram;
  private readonly u: Record<"viewProj" | "pxToClip" | "dpr" | "hdrGain", WebGLUniformLocation | null>;

  constructor(private readonly gl: WebGL2RenderingContext) {
    this.program = createProgram(gl, MARKS_VS, MARKS_FS);
    this.u = {
      viewProj: uniform(gl, this.program, "u_viewProj"),
      pxToClip: uniform(gl, this.program, "u_pxToClip"),
      dpr: uniform(gl, this.program, "u_dpr"),
      hdrGain: uniform(gl, this.program, "u_hdrGain"),
    };
  }

  /** `hdrGain` 0 writes sRGB colour as is; above 0 linearises it and scales it for the HDR scene. */
  use(cam: Camera, dpr: number, hdrGain: number): void {
    const gl = this.gl;
    gl.useProgram(this.program);
    gl.uniformMatrix4fv(this.u.viewProj, false, cam.viewProj);
    gl.uniform2f(this.u.pxToClip, 2 / gl.drawingBufferWidth, 2 / gl.drawingBufferHeight);
    gl.uniform1f(this.u.dpr, dpr);
    gl.uniform1f(this.u.hdrGain, hdrGain);
  }
}

/** One instanced draw of ground rings and screen bars. */
export class MarksBatch {
  private readonly vao: WebGLVertexArrayObject;
  private readonly instances: InstanceBuffer;

  constructor(
    private readonly gl: WebGL2RenderingContext, quad: WebGLBuffer, private readonly shader: MarksProgram,
    private readonly hdrGain = 0,
  ) {
    this.instances = new InstanceBuffer(gl, STRIDE, 256);
    this.vao = gl.createVertexArray();
    gl.bindVertexArray(this.vao);
    bindQuad(gl, quad);
    this.instances.bindAttributes([
      { location: 1, size: 4 },
      { location: 2, size: 4 },
      { location: 3, size: 4 },
    ]);
    gl.bindVertexArray(null);
  }

  reset(): void {
    this.instances.reset();
  }

  ring(x: number, y: number, z: number, radius: number, thickPx: number, c: Rgba): void {
    this.write(x, y, z, RING, radius, thickPx, 0, 0, c);
  }

  /** A bar centred above (x, y, z), raised `liftPx` on screen. */
  bar(x: number, y: number, z: number, widthPx: number, heightPx: number, fill: number, liftPx: number, c: Rgba): void {
    this.write(x, y, z, BAR, widthPx, heightPx, Math.min(1, Math.max(0, fill)), liftPx, c);
  }

  draw(cam: Camera, dpr: number): void {
    if (this.instances.count === 0) return;
    const gl = this.gl;
    this.instances.upload();
    this.shader.use(cam, dpr, this.hdrGain);
    gl.bindVertexArray(this.vao);
    gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, this.instances.count);
    gl.bindVertexArray(null);
  }

  private write(x: number, y: number, z: number, kind: number, a: number, b: number, c: number, d: number, rgba: Rgba): void {
    const o = this.instances.push();
    const v = this.instances.data;
    v[o] = x; v[o + 1] = y; v[o + 2] = z; v[o + 3] = kind;
    v[o + 4] = a; v[o + 5] = b; v[o + 6] = c; v[o + 7] = d;
    v[o + 8] = rgba[0]; v[o + 9] = rgba[1]; v[o + 10] = rgba[2]; v[o + 11] = rgba[3];
  }
}
