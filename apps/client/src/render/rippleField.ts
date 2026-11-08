import type { Terrain } from "@mf/sim";
import type { RippleGrid } from "./rippleGrid.ts";

/** A texture and the framebuffer that renders into it. */
export interface Target {
  texture: WebGLTexture;
  fbo: WebGLFramebuffer;
}

/**
 * The ripple field's GPU memory for one terrain: two state targets that swap each step
 * (R height, G velocity, B foam; NEAREST), the RGBA16F output (LINEAR), and the ground depth texture
 * (R16F, one texel per terrain vertex, LINEAR). Needs EXT_color_buffer_float.
 */
export class RippleField {
  readonly output: Target;
  readonly depth: WebGLTexture;
  /** True when some vertex lies below the sea level. A dry map skips the step. */
  hasWater = false;
  private readonly states: [Target, Target];
  private current = 0;
  private depthData: Float32Array;

  constructor(private readonly gl: WebGL2RenderingContext, readonly grid: RippleGrid, terrain: Terrain) {
    this.states = [target(gl, grid, gl.NEAREST), target(gl, grid, gl.NEAREST)];
    this.output = target(gl, grid, gl.LINEAR);
    this.depthData = new Float32Array(terrain.cols * terrain.rows);
    this.depth = depthTexture(gl, terrain.cols, terrain.rows);
    this.uploadGround(terrain);
    this.clear();
  }

  /** The state the next splat or step reads. */
  get state(): Target {
    return this.states[this.current]!;
  }

  /** The state the next step writes. */
  get next(): Target {
    return this.states[1 - this.current]!;
  }

  swap(): void {
    this.current = 1 - this.current;
  }

  /** Writes sea level − ground for every vertex. The grid size must match the one this field was built for. */
  uploadGround(terrain: Terrain): void {
    const gl = this.gl;
    const d = this.depthData;
    let wet = false;
    for (let i = 0; i < d.length; i++) {
      d[i] = terrain.seaLevel - terrain.heights[i]!;
      if (d[i]! > 0) wet = true;
    }
    this.hasWater = wet;
    gl.bindTexture(gl.TEXTURE_2D, this.depth);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, terrain.cols, terrain.rows, gl.RED, gl.FLOAT, d);
    gl.bindTexture(gl.TEXTURE_2D, null);
  }

  /** Still water: zero height, velocity, foam and slope. Leaves no framebuffer bound. */
  clear(): void {
    const gl = this.gl;
    gl.clearColor(0, 0, 0, 0);
    for (const t of [...this.states, this.output]) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, t.fbo);
      gl.clear(gl.COLOR_BUFFER_BIT);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  dispose(): void {
    const gl = this.gl;
    for (const t of [...this.states, this.output]) {
      gl.deleteFramebuffer(t.fbo);
      gl.deleteTexture(t.texture);
    }
    gl.deleteTexture(this.depth);
  }
}

function target(gl: WebGL2RenderingContext, grid: RippleGrid, filter: number): Target {
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA16F, grid.cols, grid.rows);
  params(gl, filter);
  gl.bindTexture(gl.TEXTURE_2D, null);
  const fbo = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  return { texture, fbo };
}

function depthTexture(gl: WebGL2RenderingContext, cols: number, rows: number): WebGLTexture {
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texStorage2D(gl.TEXTURE_2D, 1, gl.R16F, cols, rows);
  params(gl, gl.LINEAR);
  gl.bindTexture(gl.TEXTURE_2D, null);
  return tex;
}

function params(gl: WebGL2RenderingContext, filter: number): void {
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
}
