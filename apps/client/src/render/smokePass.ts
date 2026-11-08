import type { Camera } from "../game/camera.ts";
import type { Puff, SmokeField } from "../game/smoke.ts";
import type { Vision } from "../game/vision.ts";
import { cameraAxes } from "./cameraAxes.ts";
import { createProgram, uniform } from "./gl.ts";
import { translucent } from "./glState.ts";
import { bindQuad, InstanceBuffer } from "./instances.ts";

/** x, y, z, size · alpha, shade, seed. */
const STRIDE = 7;

const VS = `#version 300 es
precision highp float;
layout(location = 0) in vec2 a_corner;
layout(location = 1) in vec4 i_posSize;
layout(location = 2) in vec3 i_look;
uniform mat4 u_viewProj;
uniform vec3 u_right;
uniform vec3 u_up;
out vec2 v_uv;
flat out vec3 v_look;
void main() {
  float a = i_look.z * 6.2832;
  vec2 c = vec2(cos(a) * a_corner.x - sin(a) * a_corner.y, sin(a) * a_corner.x + cos(a) * a_corner.y) * i_posSize.w;
  v_uv = a_corner;
  v_look = i_look;
  gl_Position = u_viewProj * vec4(i_posSize.xyz + u_right * c.x + u_up * c.y, 1.0);
}
`;

const FS = `#version 300 es
precision highp float;
in vec2 v_uv;
flat in vec3 v_look;
out vec4 o_color;

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

void main() {
  vec2 p = v_uv * 2.2 + v_look.z * 41.0;
  float n = noise(p) * 0.65 + noise(p * 2.3) * 0.35;
  float r = length(v_uv) + (n - 0.5) * 0.55;
  float a = (1.0 - smoothstep(0.15, 0.9, r)) * v_look.x;
  vec3 grey = pow(vec3(v_look.y), vec3(2.2)) * (1.3 + 1.1 * (v_uv.y * 0.5 + 0.5)) * (0.75 + 0.5 * n);
  o_color = vec4(grey * vec3(1.0, 0.97, 0.93), a);
}
`;

/** Smoke clouds in the air. One instanced alpha-blended draw. */
export class SmokePass {
  private readonly program: WebGLProgram;
  private readonly u: Record<"viewProj" | "right" | "up", WebGLUniformLocation | null>;
  private readonly vao: WebGLVertexArrayObject;
  private readonly instances: InstanceBuffer;
  private readonly right = new Float32Array(3);
  private readonly up = new Float32Array(3);

  constructor(private readonly gl: WebGL2RenderingContext, quad: WebGLBuffer) {
    this.program = createProgram(gl, VS, FS);
    this.u = {
      viewProj: uniform(gl, this.program, "u_viewProj"),
      right: uniform(gl, this.program, "u_right"),
      up: uniform(gl, this.program, "u_up"),
    };
    this.instances = new InstanceBuffer(gl, STRIDE, 256);
    this.vao = gl.createVertexArray();
    gl.bindVertexArray(this.vao);
    bindQuad(gl, quad);
    this.instances.bindAttributes([
      { location: 1, size: 4 },
      { location: 2, size: 3 },
    ]);
    gl.bindVertexArray(null);
  }

  /** Records this frame's puffs where the local player sees. */
  fill(field: SmokeField, vision: Vision): void {
    this.instances.reset();
    for (let i = 0; i < field.count; i++) {
      const p = field.items[i]!;
      if (vision.sees(p.x, p.y)) writePuff(this.instances, p);
    }
  }

  drawPuffs(cam: Camera): void {
    if (this.instances.count === 0) return;
    const gl = this.gl;
    translucent(gl);
    this.instances.upload();
    gl.useProgram(this.program);
    cameraAxes(cam, this.right, this.up);
    gl.uniformMatrix4fv(this.u.viewProj, false, cam.viewProj);
    gl.uniform3fv(this.u.right, this.right);
    gl.uniform3fv(this.u.up, this.up);
    gl.bindVertexArray(this.vao);
    gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, this.instances.count);
    gl.bindVertexArray(null);
  }
}

/** Fades in fast, grows, and thins out as it ages. */
function writePuff(buf: InstanceBuffer, p: Puff): void {
  const t = p.age / p.life;
  const alpha = Math.min(1, t / 0.06) * Math.pow(1 - t, 1.5) * 0.6;
  const o = buf.push();
  const d = buf.data;
  d[o] = p.x; d[o + 1] = p.y; d[o + 2] = p.z; d[o + 3] = p.size * (1 + (p.grow - 1) * Math.sqrt(t));
  d[o + 4] = alpha; d[o + 5] = p.shade; d[o + 6] = p.seed;
}
