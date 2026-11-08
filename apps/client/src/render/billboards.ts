import type { Camera } from "../game/camera.ts";
import { cameraAxes } from "./cameraAxes.ts";
import { createProgram, uniform } from "./gl.ts";
import { additive } from "./glState.ts";
import { bindQuad, InstanceBuffer } from "./instances.ts";

/** Shapes a billboard can take. FLAT_RING and FLAT_GLOW lie on the ground plane; SOFT and HOT glows face the camera. */
export const SOFT = 0;
export const FLAT_RING = 1;
export const HOT = 2;
/** A soft disc with a faint rim and no white core: radar contacts. */
export const FLAT_GLOW = 3;

/** x, y, z, size · r, g, b, a · shape. */
const STRIDE = 9;

const VS = `#version 300 es
precision highp float;
layout(location = 0) in vec2 a_corner;
layout(location = 1) in vec4 i_posSize;
layout(location = 2) in vec4 i_color;
layout(location = 3) in float i_shape;
uniform mat4 u_viewProj;
uniform vec3 u_right;
uniform vec3 u_up;
out vec2 v_uv;
out vec4 v_color;
flat out int v_shape;
void main() {
  v_shape = int(i_shape + 0.5);
  vec3 offset = v_shape == 1 || v_shape == 3 ? vec3(a_corner, 0.0) : u_right * a_corner.x + u_up * a_corner.y;
  v_uv = a_corner;
  v_color = i_color;
  gl_Position = u_viewProj * vec4(i_posSize.xyz + offset * i_posSize.w, 1.0);
}
`;

/** HDR light: colours are sRGB, linearised and scaled by u_gain so cores overexpose to white. */
const FS = `#version 300 es
precision highp float;
uniform float u_gain;
in vec2 v_uv;
in vec4 v_color;
flat in int v_shape;
out vec4 o_color;
void main() {
  float r = length(v_uv);
  float a;
  if (v_shape == 1) {
    a = smoothstep(0.72, 0.9, r) * (1.0 - smoothstep(0.9, 1.0, r));
  } else if (v_shape == 3) {
    float disc = pow(max(0.0, 1.0 - r), 1.5);
    float rim = smoothstep(0.6, 0.75, r) * (1.0 - smoothstep(0.75, 0.95, r));
    a = disc * 0.7 + rim * 0.5;
  } else {
    float glow = pow(max(0.0, 1.0 - r), 2.5);
    float core = 1.0 - smoothstep(0.0, v_shape == 2 ? 0.4 : 0.25, r);
    a = glow * 0.8 + core * (v_shape == 2 ? 1.4 : 0.6);
  }
  vec3 rgb = mix(pow(v_color.rgb, vec3(2.2)), vec3(1.0), (v_shape == 1 || v_shape == 3 ? 0.0 : 0.6) * (1.0 - smoothstep(0.0, 0.3, r)));
  o_color = vec4(rgb * a * v_color.a * u_gain, 1.0);
}
`;

const GAIN = 4.0;

/** The shared additive billboard shader. */
export class BillboardProgram {
  readonly program: WebGLProgram;
  private readonly u: Record<"viewProj" | "right" | "up" | "gain", WebGLUniformLocation | null>;
  private readonly right = new Float32Array(3);
  private readonly up = new Float32Array(3);

  constructor(private readonly gl: WebGL2RenderingContext) {
    this.program = createProgram(gl, VS, FS);
    this.u = {
      viewProj: uniform(gl, this.program, "u_viewProj"),
      right: uniform(gl, this.program, "u_right"),
      up: uniform(gl, this.program, "u_up"),
      gain: uniform(gl, this.program, "u_gain"),
    };
  }

  use(cam: Camera): void {
    const gl = this.gl;
    additive(gl);
    gl.useProgram(this.program);
    cameraAxes(cam, this.right, this.up);
    gl.uniformMatrix4fv(this.u.viewProj, false, cam.viewProj);
    gl.uniform3fv(this.u.right, this.right);
    gl.uniform3fv(this.u.up, this.up);
    gl.uniform1f(this.u.gain, GAIN);
  }
}

/** One instanced draw of billboards. Fill with `push`, then `draw`. */
export class BillboardBatch {
  private readonly vao: WebGLVertexArrayObject;
  private readonly instances: InstanceBuffer;

  constructor(private readonly gl: WebGL2RenderingContext, quad: WebGLBuffer, private readonly shader: BillboardProgram) {
    this.instances = new InstanceBuffer(gl, STRIDE, 512);
    this.vao = gl.createVertexArray();
    gl.bindVertexArray(this.vao);
    bindQuad(gl, quad);
    this.instances.bindAttributes([
      { location: 1, size: 4 },
      { location: 2, size: 4 },
      { location: 3, size: 1 },
    ]);
    gl.bindVertexArray(null);
  }

  reset(): void {
    this.instances.reset();
  }

  push(x: number, y: number, z: number, size: number, r: number, g: number, b: number, a: number, shape: number): void {
    const o = this.instances.push();
    const d = this.instances.data;
    d[o] = x; d[o + 1] = y; d[o + 2] = z; d[o + 3] = size;
    d[o + 4] = r; d[o + 5] = g; d[o + 6] = b; d[o + 7] = a;
    d[o + 8] = shape;
  }

  draw(cam: Camera): void {
    if (this.instances.count === 0) return;
    const gl = this.gl;
    this.instances.upload();
    this.shader.use(cam);
    gl.bindVertexArray(this.vao);
    gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, this.instances.count);
    gl.bindVertexArray(null);
  }
}
