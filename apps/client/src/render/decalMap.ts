import { mapHeight, mapWidth, type World } from "@mf/sim";
import type { DecalStamp, DecalStamps, Sight } from "../game/decalStamps.ts";
import { createProgram, uniform } from "./gl.ts";
import { stamp } from "./glState.ts";
import { bindQuad, InstanceBuffer } from "./instances.ts";

const SIZE = 4096;

/** x, y, radius, seed. */
const STRIDE = 4;

const VS = `#version 300 es
precision highp float;
layout(location = 0) in vec2 a_corner;
layout(location = 1) in vec4 i_stamp;
uniform vec2 u_map;
out vec2 v_uv;
flat out float v_seed;
void main() {
  float a = i_stamp.w * 6.2832;
  vec2 c = vec2(cos(a) * a_corner.x - sin(a) * a_corner.y, sin(a) * a_corner.x + cos(a) * a_corner.y) * i_stamp.z;
  v_uv = a_corner;
  v_seed = i_stamp.w;
  gl_Position = vec4((i_stamp.xy + c) / u_map * 2.0 - 1.0, 0.0, 1.0);
}
`;

const FS = `#version 300 es
precision highp float;
in vec2 v_uv;
flat in float v_seed;
out vec4 o_char;

float hash(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}

/** A ragged disc, darkest in the middle; one hit peaks near 0.85. */
void main() {
  vec2 p = v_uv * 2.2 + v_seed * 41.0;
  float n = noise(p) * 0.65 + noise(p * 2.3) * 0.35;
  float r = length(v_uv) + (n - 0.5) * 0.55;
  float c = (1.0 - smoothstep(0.35, 0.95, r)) * (0.7 + 0.2 * n);
  o_char = vec4(c);
}
`;

/**
 * The ground's battle scars: one R8 texture over the map's 0..width by 0..height, 0 clean to 1 fully charred.
 * Scorches stamp into it and stay until the world changes.
 */
export class DecalMap {
  readonly texture: WebGLTexture;
  private readonly size: number;
  private readonly fbo: WebGLFramebuffer;
  private readonly program: WebGLProgram;
  private readonly uMap: WebGLUniformLocation | null;
  private readonly vao: WebGLVertexArrayObject;
  private readonly instances: InstanceBuffer;
  private readonly push = (s: DecalStamp) => this.write(s);
  private world: World | null = null;

  constructor(private readonly gl: WebGL2RenderingContext, quad: WebGLBuffer) {
    this.size = Math.min(SIZE, gl.getParameter(gl.MAX_TEXTURE_SIZE) as number);
    this.texture = charTexture(gl, this.size);
    this.fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.texture, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    this.program = createProgram(gl, VS, FS);
    this.uMap = uniform(gl, this.program, "u_map");
    this.instances = new InstanceBuffer(gl, STRIDE, 64);
    this.vao = gl.createVertexArray();
    gl.bindVertexArray(this.vao);
    bindQuad(gl, quad);
    this.instances.bindAttributes([{ location: 1, size: 4 }]);
    gl.bindVertexArray(null);
    this.clear();
  }

  /** Call once per frame before the scene. Clears on a new world, then burns in the seen stamps. */
  update(world: World, stamps: DecalStamps, sight: Sight): void {
    if (world !== this.world) {
      this.world = world;
      this.clear();
    }
    this.instances.reset();
    stamps.drain(sight, this.push);
    if (this.instances.count > 0) this.draw(world);
  }

  private write(s: DecalStamp): void {
    const o = this.instances.push();
    const d = this.instances.data;
    d[o] = s.x; d[o + 1] = s.y; d[o + 2] = s.radius; d[o + 3] = s.seed;
  }

  private draw(world: World): void {
    const gl = this.gl;
    this.instances.upload();
    this.bind();
    stamp(gl);
    gl.useProgram(this.program);
    gl.uniform2f(this.uMap, mapWidth(world.terrain), mapHeight(world.terrain));
    gl.bindVertexArray(this.vao);
    gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, this.instances.count);
    gl.bindVertexArray(null);
    this.unbind();
  }

  private clear(): void {
    const gl = this.gl;
    this.bind();
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    this.unbind();
  }

  private bind(): void {
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, this.fbo);
    this.gl.viewport(0, 0, this.size, this.size);
  }

  private unbind(): void {
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
  }
}

function charTexture(gl: WebGL2RenderingContext, size: number): WebGLTexture {
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texStorage2D(gl.TEXTURE_2D, 1, gl.R8, size, size);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.bindTexture(gl.TEXTURE_2D, null);
  return tex;
}
