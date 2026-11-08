import { mapHeight, mapWidth, type Terrain, type VertexBox } from "@mf/sim";
import type { Camera } from "../game/camera.ts";
import type { FullscreenTriangle } from "./fullscreen.ts";
import { createProgram, staticBuffer, uniform, vertexLayout } from "./gl.ts";
import { surface } from "./glState.ts";
import { GroundHeightTexture } from "./groundHeight.ts";
import type { SceneGrab } from "./hdrTarget.ts";
import { RIPPLE_UNIT } from "./ripples.ts";
import {
  applyScene, GRAB_COLOR_UNIT, GRAB_DEPTH_UNIT, GROUND_HEIGHT_UNIT, sceneUniforms, WATER_NORMAL_UNIT,
  type SceneLights, type SceneUniforms, type SunLight,
} from "./scene.ts";
import { createTilingTexture } from "./tilingTexture.ts";
import { buildWaterGrid, WATER_COARSE_STEPS, WATER_FINE_SPACING, WATER_FINE_STEPS, waterAxis, waterReach } from "./waterMesh.ts";
import { WATER_NORMAL_FS } from "./waterNormalShader.ts";
import { WATER_FS, WATER_VS } from "./waterShader.ts";

const NORMAL_SIZE = 512;
/** The grid centre moves in steps of this, so the fine vertices stay on one lattice. */
const SNAP = WATER_FINE_SPACING * 2;
const FINE_REACH = WATER_FINE_SPACING * WATER_FINE_STEPS;

type Uniform =
  | "seaLevel" | "time" | "map" | "grid" | "cell" | "centre" | "waveFade" | "invViewProj"
  | "ground" | "ripples" | "grabColor" | "grabDepth" | "normals";

interface GpuGrid {
  vao: WebGLVertexArrayObject;
  vbo: WebGLBuffer;
  ibo: WebGLBuffer;
  count: number;
  reach: number;
}

/**
 * The sea: one plane at `terrain.seaLevel` under the whole map and its mirrored surround, drawn after the opaque
 * scene and a grab of it. Gerstner waves move the vertices; the fragment refracts and absorbs the grabbed scene,
 * reflects it in screen space (or the sky), adds the sun glint and shore foam, and fades out at the waterline.
 */
export class WaterPass {
  private readonly program: WebGLProgram;
  private readonly scene: SceneUniforms;
  private readonly u: Record<Uniform, WebGLUniformLocation | null>;
  private readonly normals: WebGLTexture;
  private readonly noRipples: WebGLTexture;
  private readonly ground: GroundHeightTexture;
  private grid: GpuGrid | null = null;

  constructor(private readonly gl: WebGL2RenderingContext, tri: FullscreenTriangle) {
    const p = createProgram(gl, WATER_VS, WATER_FS);
    this.program = p;
    this.scene = sceneUniforms(gl, p);
    const names: Uniform[] = [
      "seaLevel", "time", "map", "grid", "cell", "centre", "waveFade", "invViewProj", "ground", "ripples", "grabColor", "grabDepth", "normals",
    ];
    this.u = Object.fromEntries(names.map((n) => [n, uniform(gl, p, `u_${n}`)])) as Record<Uniform, WebGLUniformLocation | null>;
    this.normals = createTilingTexture(gl, tri, WATER_NORMAL_FS, NORMAL_SIZE);
    this.noRipples = zeroTexture(gl);
    this.ground = new GroundHeightTexture(gl);
  }

  /** The heights in `box` changed in place: the ground height map follows. */
  refresh(terrain: Terrain, box: VertexBox): void {
    this.ground.update(terrain, box);
  }

  /** Into the bound scene target, after `grab`. `ripples` is the ripple field, or null for calm water. */
  draw(terrain: Terrain, cam: Camera, sun: SunLight, lights: SceneLights, grab: SceneGrab, ripples: WebGLTexture | null, time: number): void {
    const gl = this.gl;
    this.ground.sync(terrain);
    const grid = this.gridFor(mapWidth(terrain), mapHeight(terrain));
    surface(gl);
    gl.useProgram(this.program);
    applyScene(gl, this.scene, cam, sun, lights);
    this.bindTextures(grab, ripples);
    this.setUniforms(terrain, cam, time);
    gl.bindVertexArray(grid.vao);
    gl.drawElements(gl.TRIANGLES, grid.count, gl.UNSIGNED_INT, 0);
    gl.bindVertexArray(null);
  }

  private bindTextures(grab: SceneGrab, ripples: WebGLTexture | null): void {
    const gl = this.gl;
    bindAt(gl, this.u.ground, GROUND_HEIGHT_UNIT, this.ground.texture);
    bindAt(gl, this.u.ripples, RIPPLE_UNIT, ripples ?? this.noRipples);
    bindAt(gl, this.u.grabColor, GRAB_COLOR_UNIT, grab.color);
    bindAt(gl, this.u.grabDepth, GRAB_DEPTH_UNIT, grab.depth);
    bindAt(gl, this.u.normals, WATER_NORMAL_UNIT, this.normals);
    gl.activeTexture(gl.TEXTURE0);
  }

  private setUniforms(terrain: Terrain, cam: Camera, time: number): void {
    const gl = this.gl;
    const u = this.u;
    gl.uniform1f(u.seaLevel, terrain.seaLevel);
    gl.uniform1f(u.time, time);
    gl.uniform2f(u.map, mapWidth(terrain), mapHeight(terrain));
    gl.uniform2f(u.grid, terrain.cols, terrain.rows);
    gl.uniform1f(u.cell, terrain.cell);
    gl.uniform2f(u.centre, Math.round(cam.x / SNAP) * SNAP, Math.round(cam.y / SNAP) * SNAP);
    gl.uniform2f(u.waveFade, FINE_REACH * 0.6, FINE_REACH * 0.95);
    gl.uniformMatrix4fv(u.invViewProj, false, cam.invViewProj);
  }

  /** The grid reaches the mirrored surround's edge from anywhere on the map. Rebuilt only when that reach changes. */
  private gridFor(width: number, height: number): GpuGrid {
    const reach = waterReach(width, height);
    if (this.grid?.reach === reach) return this.grid;
    if (this.grid) this.release(this.grid);
    const mesh = buildWaterGrid(waterAxis(reach, WATER_FINE_SPACING, WATER_FINE_STEPS, WATER_COARSE_STEPS));
    const gl = this.gl;
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    const vbo = staticBuffer(gl, gl.ARRAY_BUFFER, mesh.positions);
    vertexLayout(gl, [2]);
    const ibo = staticBuffer(gl, gl.ELEMENT_ARRAY_BUFFER, mesh.indices);
    gl.bindVertexArray(null);
    this.grid = { vao, vbo, ibo, count: mesh.indices.length, reach };
    return this.grid;
  }

  private release(g: GpuGrid): void {
    this.gl.deleteVertexArray(g.vao);
    this.gl.deleteBuffer(g.vbo);
    this.gl.deleteBuffer(g.ibo);
  }
}

function bindAt(gl: WebGL2RenderingContext, loc: WebGLUniformLocation | null, unit: number, tex: WebGLTexture | null): void {
  gl.uniform1i(loc, unit);
  gl.activeTexture(gl.TEXTURE0 + unit);
  gl.bindTexture(gl.TEXTURE_2D, tex);
}

/** 1 by 1, all zero: calm water where there is no ripple field. */
function zeroTexture(gl: WebGL2RenderingContext): WebGLTexture {
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4));
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.bindTexture(gl.TEXTURE_2D, null);
  return tex;
}
