import type { MapSize } from "@mf/sim";
import type { Camera } from "../game/camera.ts";
import { mat4, multiply } from "../game/mat4.ts";
import { shadowCaster } from "./glState.ts";
import { fitLight } from "./lightFrustum.ts";
import { SUN, type SunLight } from "./scene.ts";

const SIZE = 4096;

/** Fragment shader for depth-only passes. */
export const DEPTH_FS = `#version 300 es
precision mediump float;
void main() {}
`;

/** Maps clip space -1..1 to texture space 0..1. */
const BIAS = new Float32Array([0.5, 0, 0, 0, 0, 0.5, 0, 0, 0, 0, 0.5, 0, 0.5, 0.5, 0.5, 1]);

/** The sun's depth map, refitted to the camera's view each frame. */
export class ShadowMap implements SunLight {
  readonly shadowMat = mat4();
  readonly texture: WebGLTexture;
  /** World → light clip space. Casters render with this. */
  readonly viewProj = mat4();
  readonly texelUv: number;
  texelWorld = 1;
  private readonly size: number;
  private readonly fbo: WebGLFramebuffer;
  private readonly view = mat4();
  private readonly proj = mat4();

  constructor(private readonly gl: WebGL2RenderingContext) {
    this.size = Math.min(SIZE, gl.getParameter(gl.MAX_TEXTURE_SIZE) as number);
    this.texelUv = 1 / this.size;
    this.texture = depthTexture(gl, this.size);
    this.fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, this.texture, 0);
    gl.drawBuffers([gl.NONE]);
    gl.readBuffer(gl.NONE);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  fit(cam: Camera, map: MapSize): void {
    this.texelWorld = fitLight(this.view, this.proj, this.viewProj, cam.invViewProj, SUN, this.size, map);
    multiply(this.shadowMat, BIAS, this.viewProj);
  }

  /** Binds and clears the map. Draw casters with `viewProj`, then call `end`. */
  begin(): void {
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
    gl.viewport(0, 0, this.size, this.size);
    shadowCaster(gl);
    gl.clear(gl.DEPTH_BUFFER_BIT);
  }

  end(): void {
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null);
  }
}

function depthTexture(gl: WebGL2RenderingContext, size: number): WebGLTexture {
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texStorage2D(gl.TEXTURE_2D, 1, gl.DEPTH_COMPONENT24, size, size);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_MODE, gl.COMPARE_REF_TO_TEXTURE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_FUNC, gl.LEQUAL);
  gl.bindTexture(gl.TEXTURE_2D, null);
  return tex;
}
