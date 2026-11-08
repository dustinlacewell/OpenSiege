import type { Camera } from "../game/camera.ts";
import type { LineSink, LineStyle } from "../game/groundLines.ts";
import { createProgram, uniform } from "./gl.ts";
import { bindQuad, InstanceBuffer } from "./instances.ts";

/** a xyz · b xyz · rgb, width px · opacity at a, opacity at b. */
const STRIDE = 12;

/** Each segment is a quad widened in screen space, with an antialiased edge. */
const VS = `#version 300 es
precision highp float;
layout(location = 0) in vec2 a_corner;
layout(location = 1) in vec3 i_a;
layout(location = 2) in vec3 i_b;
layout(location = 3) in vec4 i_colorWidth;
layout(location = 4) in vec2 i_alpha;
uniform mat4 u_viewProj;
uniform vec2 u_viewport;
uniform float u_dpr;
out vec4 v_color;
out float v_side;
flat out float v_half;
void main() {
  float t = a_corner.x * 0.5 + 0.5;
  vec4 ca = u_viewProj * vec4(i_a, 1.0);
  vec4 cb = u_viewProj * vec4(i_b, 1.0);
  vec2 sa = ca.xy / max(ca.w, 1e-4) * u_viewport;
  vec2 sb = cb.xy / max(cb.w, 1e-4) * u_viewport;
  vec2 d = sb - sa;
  vec2 dir = length(d) > 1e-4 ? normalize(d) : vec2(1.0, 0.0);
  float halfPx = i_colorWidth.w * u_dpr * 0.5;
  float side = a_corner.y * (halfPx + 1.0);
  vec4 c = mix(ca, cb, t);
  c.xy += vec2(-dir.y, dir.x) * side / u_viewport * c.w;
  v_color = vec4(i_colorWidth.rgb, mix(i_alpha.x, i_alpha.y, t));
  v_side = side;
  v_half = halfPx;
  gl_Position = c;
}
`;

const FS = `#version 300 es
precision highp float;
uniform float u_gain;
in vec4 v_color;
in float v_side;
flat in float v_half;
out vec4 o_color;
void main() {
  float a = clamp(v_half + 0.5 - abs(v_side), 0.0, 1.0);
  o_color = vec4(pow(v_color.rgb, vec3(2.2)) * u_gain, v_color.a * a);
}
`;

/** Brings line colours to their nominal brightness after tone mapping. */
const GAIN = 2.4;

/** World-space lines of any pixel width, batched into one instanced draw. Caller sets blend state. */
export class LineBatch implements LineSink {
  private readonly program: WebGLProgram;
  private readonly u: Record<"viewProj" | "viewport" | "dpr" | "gain", WebGLUniformLocation | null>;
  private readonly vao: WebGLVertexArrayObject;
  private readonly instances: InstanceBuffer;

  constructor(private readonly gl: WebGL2RenderingContext, quad: WebGLBuffer) {
    this.program = createProgram(gl, VS, FS);
    this.u = {
      viewProj: uniform(gl, this.program, "u_viewProj"),
      viewport: uniform(gl, this.program, "u_viewport"),
      dpr: uniform(gl, this.program, "u_dpr"),
      gain: uniform(gl, this.program, "u_gain"),
    };
    this.instances = new InstanceBuffer(gl, STRIDE, 2048);
    this.vao = gl.createVertexArray();
    gl.bindVertexArray(this.vao);
    bindQuad(gl, quad);
    this.instances.bindAttributes([
      { location: 1, size: 3 },
      { location: 2, size: 3 },
      { location: 3, size: 4 },
      { location: 4, size: 2 },
    ]);
    gl.bindVertexArray(null);
  }

  reset(): void {
    this.instances.reset();
  }

  segment(ax: number, ay: number, az: number, bx: number, by: number, bz: number, s: LineStyle, fadeA: number, fadeB: number): void {
    const o = this.instances.push();
    const d = this.instances.data;
    d[o] = ax; d[o + 1] = ay; d[o + 2] = az;
    d[o + 3] = bx; d[o + 4] = by; d[o + 5] = bz;
    d[o + 6] = s.r; d[o + 7] = s.g; d[o + 8] = s.b; d[o + 9] = s.widthPx;
    d[o + 10] = s.a * fadeA; d[o + 11] = s.a * fadeB;
  }

  draw(cam: Camera, dpr: number): void {
    if (this.instances.count === 0) return;
    const gl = this.gl;
    this.instances.upload();
    gl.useProgram(this.program);
    gl.uniformMatrix4fv(this.u.viewProj, false, cam.viewProj);
    gl.uniform2f(this.u.viewport, gl.drawingBufferWidth / 2, gl.drawingBufferHeight / 2);
    gl.uniform1f(this.u.dpr, dpr);
    gl.uniform1f(this.u.gain, GAIN);
    gl.bindVertexArray(this.vao);
    gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, this.instances.count);
    gl.bindVertexArray(null);
  }
}
