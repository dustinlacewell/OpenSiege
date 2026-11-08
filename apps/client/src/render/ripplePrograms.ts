import type { SplatSink } from "../game/rippleSources.ts";
import { FULLSCREEN_VS, FullscreenTriangle } from "./fullscreen.ts";
import { createProgram, createQuad, uniform } from "./gl.ts";
import { accumulate, fullscreen } from "./glState.ts";
import { bindQuad, InstanceBuffer } from "./instances.ts";
import type { RippleField, Target } from "./rippleField.ts";
import { OUTPUT_FS, SPLAT_FS, SPLAT_VS, STEP_FS } from "./rippleShader.ts";

/** Wave speed over the water, world units per second. Below most hull speeds, so fast units leave a V. */
export const WAVE_SPEED = 150;
/** Fixed step rate of the field, Hz. */
export const STEP_HZ = 60;
/** Velocity kept per step. 0.99 at 60 Hz: a wave halves in about 1.2 s. */
const DAMP = 0.99;
/** Foam kept per step. 0.97 at 60 Hz: foam halves in about 0.4 s. */
const FOAM_DECAY = 0.97;
/** Depth (world units) over which the wave fades to nothing at the shore. */
const SHORE_FADE = 6;
/** Water shallower than this (world units) makes foam where it moves. */
const SHORE_FOAM_DEPTH = 25;
/** Foam per step per unit of slope above SLOPE_FOAM, and per world unit of velocity in shallow water. */
const FOAM_GAIN_SLOPE = 0.4;
const FOAM_GAIN_SHORE = 0.08;
const SLOPE_FOAM = 0.25;
/** Most splats drawn per frame. The rest drop. */
export const MAX_SPLATS = 256;
/** Stability bound per axis: c² summed over both axes must stay under 0.5. */
const MAX_C2 = 0.24;

/** x, y, radius, height, foam. */
const STRIDE = 5;

/** Sampler units for the field's own passes. RIPPLE_UNIT is free before the water draws; units 1..6 are not touched. */
const STATE_UNIT = 0;

/** The three GPU passes of the ripple field: splat, step, output. Collects splats as a SplatSink. */
export class RipplePrograms implements SplatSink {
  private readonly splatProgram: WebGLProgram;
  private readonly stepProgram: WebGLProgram;
  private readonly outputProgram: WebGLProgram;
  private readonly splatU: { map: WebGLUniformLocation | null };
  private readonly stepU: Record<"state" | "depth" | "cell" | "c2" | "damp" | "foamDecay" | "texel" | "shore" | "foamGain" | "slopeFoam", WebGLUniformLocation | null>;
  private readonly outputU: { state: WebGLUniformLocation | null; texel: WebGLUniformLocation | null };
  private readonly vao: WebGLVertexArrayObject;
  private readonly quad: WebGLBuffer;
  private readonly instances: InstanceBuffer;
  private readonly tri: FullscreenTriangle;

  constructor(private readonly gl: WebGL2RenderingContext, private readonly depthUnit: number) {
    this.splatProgram = createProgram(gl, SPLAT_VS, SPLAT_FS);
    this.stepProgram = createProgram(gl, FULLSCREEN_VS, STEP_FS);
    this.outputProgram = createProgram(gl, FULLSCREEN_VS, OUTPUT_FS);
    this.splatU = { map: uniform(gl, this.splatProgram, "u_map") };
    const s = (name: string) => uniform(gl, this.stepProgram, `u_${name}`);
    this.stepU = {
      state: s("state"), depth: s("depth"), cell: s("cell"), c2: s("c2"), damp: s("damp"), foamDecay: s("foamDecay"),
      texel: s("texel"), shore: s("shore"), foamGain: s("foamGain"), slopeFoam: s("slopeFoam"),
    };
    this.outputU = { state: uniform(gl, this.outputProgram, "u_state"), texel: uniform(gl, this.outputProgram, "u_texel") };
    this.quad = createQuad(gl);
    this.instances = new InstanceBuffer(gl, STRIDE, 64);
    this.vao = gl.createVertexArray();
    gl.bindVertexArray(this.vao);
    bindQuad(gl, this.quad);
    this.instances.bindAttributes([{ location: 1, size: 3 }, { location: 2, size: 2 }]);
    gl.bindVertexArray(null);
    this.tri = new FullscreenTriangle(gl);
  }

  /** Splats waiting for `drawSplats`. */
  get pending(): number {
    return this.instances.count;
  }

  resetSplats(): void {
    this.instances.reset();
  }

  splat(x: number, y: number, radius: number, height: number, foam: number): void {
    if (this.instances.count >= MAX_SPLATS) return;
    const o = this.instances.push();
    const d = this.instances.data;
    d[o] = x; d[o + 1] = y; d[o + 2] = radius; d[o + 3] = height; d[o + 4] = foam;
  }

  /** Adds the pending splats into the current state. */
  drawSplats(field: RippleField, mapW: number, mapH: number): void {
    const gl = this.gl;
    this.instances.upload();
    into(gl, field.state, field);
    accumulate(gl);
    gl.useProgram(this.splatProgram);
    gl.uniform2f(this.splatU.map, mapW, mapH);
    gl.bindVertexArray(this.vao);
    gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, this.instances.count);
    gl.bindVertexArray(null);
  }

  /** One wave step from the current state into the next, then swaps. `cell` is the terrain vertex spacing. */
  step(field: RippleField, cell: number): void {
    const gl = this.gl;
    const g = field.grid;
    const u = this.stepU;
    into(gl, field.next, field);
    fullscreen(gl);
    gl.useProgram(this.stepProgram);
    bindAt(gl, STATE_UNIT, field.state.texture);
    bindAt(gl, this.depthUnit, field.depth);
    gl.uniform1i(u.state, STATE_UNIT);
    gl.uniform1i(u.depth, this.depthUnit);
    gl.uniform1f(u.cell, cell);
    gl.uniform2f(u.c2, c2(g.texelX), c2(g.texelY));
    gl.uniform1f(u.damp, DAMP);
    gl.uniform1f(u.foamDecay, FOAM_DECAY);
    gl.uniform2f(u.texel, g.texelX, g.texelY);
    gl.uniform2f(u.shore, SHORE_FADE, SHORE_FOAM_DEPTH);
    gl.uniform2f(u.foamGain, FOAM_GAIN_SLOPE, FOAM_GAIN_SHORE);
    gl.uniform1f(u.slopeFoam, SLOPE_FOAM);
    this.tri.draw();
    field.swap();
  }

  /** Writes the contract texture from the current state. */
  output(field: RippleField): void {
    const gl = this.gl;
    into(gl, field.output, field);
    fullscreen(gl);
    gl.useProgram(this.outputProgram);
    bindAt(gl, STATE_UNIT, field.state.texture);
    gl.uniform1i(this.outputU.state, STATE_UNIT);
    gl.uniform2f(this.outputU.texel, field.grid.texelX, field.grid.texelY);
    this.tri.draw();
  }
}

/** c² for one axis, in texels² per step², capped for stability. */
function c2(texel: number): number {
  const c = WAVE_SPEED / STEP_HZ / texel;
  return Math.min(MAX_C2, c * c);
}

function into(gl: WebGL2RenderingContext, t: Target, field: RippleField): void {
  gl.bindFramebuffer(gl.FRAMEBUFFER, t.fbo);
  gl.viewport(0, 0, field.grid.cols, field.grid.rows);
}

function bindAt(gl: WebGL2RenderingContext, unit: number, tex: WebGLTexture): void {
  gl.activeTexture(gl.TEXTURE0 + unit);
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.activeTexture(gl.TEXTURE0);
}
