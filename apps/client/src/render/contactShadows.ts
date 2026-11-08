import { UNIT_STATS } from "@mf/sim";
import type { Camera } from "../game/camera.ts";
import type { PoseTable } from "../game/poses.ts";
import { createProgram, uniform } from "./gl.ts";
import { decal } from "./glState.ts";
import { bindQuad, InstanceBuffer } from "./instances.ts";
import { POSE_GLSL } from "./unitShader.ts";

/** x, y, z, yaw · pitch, roll, radius. */
const STRIDE = 7;

const VS = `#version 300 es
precision highp float;
layout(location = 0) in vec2 a_corner;
layout(location = 1) in vec4 i_posYaw;
layout(location = 2) in vec3 i_tiltRadius;
uniform mat4 u_viewProj;
${POSE_GLSL}
out vec2 v_uv;
void main() {
  vec3 p = vec3(a_corner * vec2(1.15, 0.95) * i_tiltRadius.z, 1.5);
  p = tilt(p, i_tiltRadius.x, i_tiltRadius.y);
  p.xy = rot(p.xy, i_posYaw.w);
  v_uv = a_corner;
  gl_Position = u_viewProj * vec4(p + i_posYaw.xyz, 1.0);
}
`;

const FS = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 o_color;
void main() {
  float a = 1.0 - smoothstep(0.2, 1.0, length(v_uv));
  o_color = vec4(0.0, 0.0, 0.0, a * a * 0.35);
}
`;

/** A faint dark contact patch under each unit, tilted to its slope. The sun's shadow map does the rest. */
export class ContactShadowsPass {
  private readonly program: WebGLProgram;
  private readonly uViewProj: WebGLUniformLocation | null;
  private readonly vao: WebGLVertexArrayObject;
  private readonly instances: InstanceBuffer;

  constructor(private readonly gl: WebGL2RenderingContext, quad: WebGLBuffer) {
    this.program = createProgram(gl, VS, FS);
    this.uViewProj = uniform(gl, this.program, "u_viewProj");
    this.instances = new InstanceBuffer(gl, STRIDE, 512);
    this.vao = gl.createVertexArray();
    gl.bindVertexArray(this.vao);
    bindQuad(gl, quad);
    this.instances.bindAttributes([
      { location: 1, size: 4 },
      { location: 2, size: 3 },
    ]);
    gl.bindVertexArray(null);
  }

  draw(poses: PoseTable, cam: Camera): void {
    this.fill(poses);
    if (this.instances.count === 0) return;
    const gl = this.gl;
    this.instances.upload();
    decal(gl);
    gl.useProgram(this.program);
    gl.uniformMatrix4fv(this.uViewProj, false, cam.viewProj);
    gl.bindVertexArray(this.vao);
    gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, this.instances.count);
    gl.bindVertexArray(null);
  }

  private fill(poses: PoseTable): void {
    const buf = this.instances;
    buf.reset();
    for (let i = 0; i < poses.count; i++) {
      const p = poses.poses[i]!;
      const o = buf.push();
      const d = buf.data;
      d[o] = p.x; d[o + 1] = p.y; d[o + 2] = p.z; d[o + 3] = p.yaw;
      d[o + 4] = p.pitch; d[o + 5] = p.roll; d[o + 6] = UNIT_STATS[p.unit.kind].radius;
    }
  }
}
