import { UNIT_KINDS, UNIT_STATS, type UnitKind } from "@mf/sim";
import type { PoseTable, UnitPose } from "../game/poses.ts";
import { createProgram, staticBuffer, uniform, vertexLayout } from "./gl.ts";
import { opaque } from "./glState.ts";
import { InstanceBuffer } from "./instances.ts";
import { VERTEX_FLOATS } from "./meshBuilder.ts";
import { UNIT_MESHES, type UnitMesh } from "./meshes.ts";
import { applyScene, NO_LIGHTS, sceneUniforms, type SceneLights, type SceneUniforms, type SceneView, type SunLight } from "./scene.ts";
import { DEPTH_FS } from "./shadowMap.ts";
import type { TeamColors } from "./teamColors.ts";
import { UNIT_FS, UNIT_VS } from "./unitShader.ts";

/** x, y, z, yaw · aim, pitch, roll, siege · team rgb · gun, swing. */
const STRIDE = 13;

/** The pose fields one instance carries. */
export type InstancePose = Omit<UnitPose, "unit">;

interface KindDraw {
  mesh: UnitMesh;
  /** How far the hull sinks when fully sieged: the sim's `sink` stat. */
  sink: number;
  vao: WebGLVertexArrayObject;
  vertexCount: number;
  instances: InstanceBuffer;
}

/** Per-kind uniforms of one unit program. */
interface MeshUniforms {
  lower: WebGLUniformLocation | null;
  legLift: WebGLUniformLocation | null;
  base: WebGLUniformLocation | null;
  mast: WebGLUniformLocation | null;
  gun: WebGLUniformLocation | null;
  time: WebGLUniformLocation | null;
}

/** Every unit, one instanced draw per kind per pass: lit into the scene, depth into the shadow map. */
export class UnitsPass {
  private readonly program: WebGLProgram;
  private readonly scene: SceneUniforms;
  private readonly u: MeshUniforms;
  private readonly depthProgram: WebGLProgram;
  private readonly depthViewProj: WebGLUniformLocation | null;
  private readonly depthU: MeshUniforms;
  private readonly kinds: Record<UnitKind, KindDraw>;
  private readonly order: KindDraw[];

  constructor(private readonly gl: WebGL2RenderingContext) {
    this.program = createProgram(gl, UNIT_VS, UNIT_FS);
    this.scene = sceneUniforms(gl, this.program);
    this.u = meshUniforms(gl, this.program);
    this.depthProgram = createProgram(gl, UNIT_VS, DEPTH_FS);
    this.depthViewProj = uniform(gl, this.depthProgram, "u_viewProj");
    this.depthU = meshUniforms(gl, this.depthProgram);
    this.order = UNIT_KINDS.map((kind) => this.createKind(kind));
    this.kinds = Object.fromEntries(UNIT_KINDS.map((kind, i) => [kind, this.order[i]!])) as Record<UnitKind, KindDraw>;
  }

  /** Fills and uploads this frame's instances. Call once before `drawDepth` and `draw`. */
  prepare(poses: PoseTable, teams: TeamColors): void {
    for (const k of this.order) k.instances.reset();
    for (let i = 0; i < poses.count; i++) {
      const p = poses.poses[i]!;
      write(this.kinds[p.unit.kind].instances, p, teams.of(p.unit.owner));
    }
    for (const k of this.order) if (k.instances.count > 0) k.instances.upload();
  }

  /** Into the bound shadow map. `time` in seconds drives the dish sweep. */
  drawDepth(lightViewProj: Float32Array, time: number): void {
    const gl = this.gl;
    gl.useProgram(this.depthProgram);
    gl.uniformMatrix4fv(this.depthViewProj, false, lightViewProj);
    gl.uniform1f(this.depthU.time, time);
    for (const k of this.order) this.drawKind(k, this.depthU);
    gl.bindVertexArray(null);
  }

  draw(cam: SceneView, sun: SunLight, lights: SceneLights, time: number): void {
    this.drawLit(this.order, cam, sun, lights, time);
  }

  /** One unit of one kind, for a headshot. Overwrites that kind's instances: call before `prepare`. */
  drawOne(kind: UnitKind, pose: InstancePose, team: readonly number[], view: SceneView, sun: SunLight): void {
    const k = this.kinds[kind];
    k.instances.reset();
    write(k.instances, pose, team);
    k.instances.upload();
    this.drawLit([k], view, sun, NO_LIGHTS, 0);
  }

  private drawLit(kinds: readonly KindDraw[], view: SceneView, sun: SunLight, lights: SceneLights, time: number): void {
    const gl = this.gl;
    opaque(gl);
    gl.useProgram(this.program);
    applyScene(gl, this.scene, view, sun, lights);
    gl.uniform1f(this.u.time, time);
    for (const k of kinds) this.drawKind(k, this.u);
    gl.bindVertexArray(null);
  }

  private drawKind(k: KindDraw, u: MeshUniforms): void {
    if (k.instances.count === 0) return;
    const gl = this.gl;
    const m = k.mesh.mast;
    gl.uniform1f(u.lower, k.sink);
    gl.uniform1f(u.legLift, k.mesh.legLift);
    gl.uniform3f(u.base, k.mesh.base[0], k.mesh.base[1], k.mesh.base[2]);
    gl.uniform3f(u.mast, m?.x ?? 0, m?.z ?? 0, m?.fold ?? 0);
    gl.uniform2f(u.gun, k.mesh.gun?.x ?? 0, k.mesh.gun?.z ?? 0);
    gl.bindVertexArray(k.vao);
    gl.drawArraysInstanced(gl.TRIANGLES, 0, k.vertexCount, k.instances.count);
  }

  private createKind(kind: UnitKind): KindDraw {
    const mesh = UNIT_MESHES[kind]();
    const gl = this.gl;
    const instances = new InstanceBuffer(gl, STRIDE, 128);
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    staticBuffer(gl, gl.ARRAY_BUFFER, mesh.vertices);
    vertexLayout(gl, [3, 3, 1]);
    instances.bindAttributes([
      { location: 3, size: 4 },
      { location: 4, size: 4 },
      { location: 5, size: 3 },
      { location: 6, size: 2 },
    ]);
    gl.bindVertexArray(null);
    return { mesh, sink: UNIT_STATS[kind].sink, vao, vertexCount: mesh.vertices.length / VERTEX_FLOATS, instances };
  }
}

function meshUniforms(gl: WebGL2RenderingContext, p: WebGLProgram): MeshUniforms {
  return {
    lower: uniform(gl, p, "u_lower"), legLift: uniform(gl, p, "u_legLift"), base: uniform(gl, p, "u_base"),
    mast: uniform(gl, p, "u_mast"), gun: uniform(gl, p, "u_gun"), time: uniform(gl, p, "u_time"),
  };
}

function write(buf: InstanceBuffer, p: InstancePose, team: readonly number[]): void {
  const o = buf.push();
  const d = buf.data;
  d[o] = p.x; d[o + 1] = p.y; d[o + 2] = p.z; d[o + 3] = p.yaw;
  d[o + 4] = p.aim; d[o + 5] = p.pitch; d[o + 6] = p.roll; d[o + 7] = p.siege;
  d[o + 8] = team[0]!; d[o + 9] = team[1]!; d[o + 10] = team[2]!;
  d[o + 11] = p.gun; d[o + 12] = p.swing;
}
