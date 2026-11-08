import { FIELD_AMOUNT, MAX_FIELDS, mapHeight, mapWidth, TERRAIN_MAX_HEIGHT, type ResourceField, type Terrain } from "@mf/sim";
import type { Camera } from "../game/camera.ts";
import { createDetailTexture } from "./detailTexture.ts";
import type { FullscreenTriangle } from "./fullscreen.ts";
import { createProgram, staticBuffer, uniform, vertexLayout } from "./gl.ts";
import { opaque } from "./glState.ts";
import { packPalette, type MaterialPalette } from "./materialPalette.ts";
import { applyScene, DECAL_UNIT, MATERIAL_UNIT, sceneUniforms, type SceneLights, type SceneUniforms, type SunLight } from "./scene.ts";
import { DEPTH_FS } from "./shadowMap.ts";
import { buildTerrainMesh, refreshTerrainMesh, type SimRect, type TerrainMesh } from "./terrainMesh.ts";
import { ringsFor } from "./surround.ts";
import { lodIndices, strideForRing } from "./surroundLod.ts";
import { TERRAIN_FS, TERRAIN_VS } from "./terrainShader.ts";

/** One index list over a mesh's vertex buffer, with the VAO that binds the two. */
interface IndexedDraw {
  vao: WebGLVertexArrayObject;
  ibo: WebGLBuffer;
  count: number;
}

interface GpuMesh {
  vbo: WebGLBuffer;
  /** The CPU copy, kept so an edit rewrites only its rows. */
  cpu: TerrainMesh;
  /** The map: one draw. The surround: one per detail level, `draws[k]` for stride `SURROUND_STRIDES[k]`. */
  draws: IndexedDraw[];
}

/** The map at full detail, and the same ground at sim resolution for its mirrored copies. */
interface Meshes {
  map: GpuMesh;
  surround: GpuMesh;
}

/** Mesh vertices per sim cell on the map. */
const MAP_SUBDIV = 4;
const SURROUND_STRIDES = [1, 2, 3, 4].map(strideForRing);

/** A painted ground: the weight map texture (see `materialTexture.ts`) and its four sRGB colours. The caller owns the texture. */
export interface TerrainMaterials {
  texture: WebGLTexture;
  palette: MaterialPalette;
}

/**
 * The ground: one indexed mesh built once per terrain (rows rewritten by `updateMesh`), scorched by the decal map,
 * lit and shadowed, with crystal fields on it. Around it, rings of mirrored copies of the whole map, so the
 * outside is the map reflected across each edge and corner, tiled into the distance.
 */
export class TerrainPass {
  private readonly program: WebGLProgram;
  private readonly scene: SceneUniforms;
  private readonly u: Record<
    "map" | "ring" | "maxHeight" | "seaLevel" | "time" | "fields" | "fieldCount" | "detail" | "decals" | "useMaterials" | "materials" | "palette",
    WebGLUniformLocation | null
  >;
  private readonly depthProgram: WebGLProgram;
  private readonly depthViewProj: WebGLUniformLocation | null;
  private readonly detail: WebGLTexture;
  private readonly fields = new Float32Array(MAX_FIELDS * 4);
  private readonly palette = new Float32Array(12);
  private materials: WebGLTexture | null = null;
  private source: Terrain | null = null;
  private meshes: Meshes | null = null;

  /** `decals` is the decal map's texture; its char darkens the ground. */
  constructor(private readonly gl: WebGL2RenderingContext, tri: FullscreenTriangle, private readonly decals: WebGLTexture) {
    const p = createProgram(gl, TERRAIN_VS, TERRAIN_FS);
    this.program = p;
    this.scene = sceneUniforms(gl, p);
    this.u = {
      map: uniform(gl, p, "u_map"),
      ring: uniform(gl, p, "u_ring"),
      maxHeight: uniform(gl, p, "u_maxHeight"),
      seaLevel: uniform(gl, p, "u_seaLevel"),
      time: uniform(gl, p, "u_time"),
      fields: uniform(gl, p, "u_fields"),
      fieldCount: uniform(gl, p, "u_fieldCount"),
      detail: uniform(gl, p, "u_detail"),
      decals: uniform(gl, p, "u_decals"),
      useMaterials: uniform(gl, p, "u_useMaterials"),
      materials: uniform(gl, p, "u_materials"),
      palette: uniform(gl, p, "u_palette"),
    };
    this.depthProgram = createProgram(gl, TERRAIN_VS, DEPTH_FS);
    this.depthViewProj = uniform(gl, this.depthProgram, "u_viewProj");
    this.detail = createDetailTexture(gl, tri);
  }

  /** Paints the ground from a weight map and palette. Null returns to the procedural ground. */
  setMaterials(layer: TerrainMaterials | null): void {
    this.materials = layer ? layer.texture : null;
    if (layer) packPalette(layer.palette, this.palette);
  }

  /** The heights in `r` changed in place: rewrite and upload only the mesh rows that read them. For an editor. */
  updateMesh(terrain: Terrain, r: SimRect): void {
    const { map, surround } = this.meshesFor(terrain);
    this.refresh(map, terrain, r);
    this.refresh(surround, terrain, r);
  }

  draw(terrain: Terrain, fields: readonly ResourceField[], cam: Camera, sun: SunLight, lights: SceneLights, time: number): void {
    const meshes = this.meshesFor(terrain);
    const gl = this.gl;
    opaque(gl);
    gl.useProgram(this.program);
    applyScene(gl, this.scene, cam, sun, lights);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.detail);
    gl.uniform1i(this.u.detail, 0);
    gl.activeTexture(gl.TEXTURE0 + DECAL_UNIT);
    gl.bindTexture(gl.TEXTURE_2D, this.decals);
    gl.uniform1i(this.u.decals, DECAL_UNIT);
    this.applyMaterials();
    gl.activeTexture(gl.TEXTURE0);
    gl.uniform2f(this.u.map, mapWidth(terrain), mapHeight(terrain));
    gl.uniform1f(this.u.maxHeight, TERRAIN_MAX_HEIGHT);
    gl.uniform1f(this.u.seaLevel, terrain.seaLevel);
    gl.uniform1f(this.u.time, time);
    gl.uniform4fv(this.u.fields, this.fields, 0, this.packFields(fields) * 4);
    gl.uniform1i(this.u.fieldCount, Math.min(fields.length, MAX_FIELDS));
    gl.uniform1i(this.u.ring, 0);
    this.drawIndexed(meshes.map.draws[0]!, 1);
    this.drawSurround(meshes.surround, ringsFor(mapWidth(terrain), mapHeight(terrain)));
  }

  /** Ring r has 8r tiles, one instance each, at a coarser stride the farther out it is. */
  private drawSurround(mesh: GpuMesh, rings: number): void {
    for (let r = 1; r <= rings; r++) {
      this.gl.uniform1i(this.u.ring, r);
      this.drawIndexed(mesh.draws[Math.min(r, mesh.draws.length) - 1]!, 8 * r);
    }
  }

  /** Into the bound shadow map. Only the map itself casts shadows. */
  drawDepth(terrain: Terrain, lightViewProj: Float32Array): void {
    const { map } = this.meshesFor(terrain);
    const gl = this.gl;
    gl.useProgram(this.depthProgram);
    gl.uniformMatrix4fv(this.depthViewProj, false, lightViewProj);
    this.drawIndexed(map.draws[0]!, 1);
  }

  /** The flag picks the shader branch. The sampler keeps its own unit; with no layer that unit holds null, so no stray texture type can clash. */
  private applyMaterials(): void {
    const gl = this.gl;
    gl.uniform1i(this.u.materials, MATERIAL_UNIT);
    gl.uniform1i(this.u.useMaterials, this.materials ? 1 : 0);
    gl.activeTexture(gl.TEXTURE0 + MATERIAL_UNIT);
    gl.bindTexture(gl.TEXTURE_2D, this.materials);
    if (this.materials) gl.uniform3fv(this.u.palette, this.palette);
  }

  private drawIndexed(d: IndexedDraw, instances: number): void {
    const gl = this.gl;
    gl.bindVertexArray(d.vao);
    gl.drawElementsInstanced(gl.TRIANGLES, d.count, gl.UNSIGNED_INT, 0, instances);
    gl.bindVertexArray(null);
  }

  /** Rewrites the rows of `mesh` that read `r` and uploads them. */
  private refresh(mesh: GpuMesh, terrain: Terrain, r: SimRect): void {
    const rows = refreshTerrainMesh(mesh.cpu, terrain, r);
    if (!rows) return;
    const w = mesh.cpu.xs.length * 6;
    const gl = this.gl;
    gl.bindBuffer(gl.ARRAY_BUFFER, mesh.vbo);
    gl.bufferSubData(gl.ARRAY_BUFFER, rows.r0 * w * 4, mesh.cpu.vertices, rows.r0 * w, (rows.r1 - rows.r0 + 1) * w);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
  }

  private meshesFor(terrain: Terrain): Meshes {
    if (this.meshes && this.source === terrain) return this.meshes;
    if (this.meshes) {
      this.release(this.meshes.map);
      this.release(this.meshes.surround);
    }
    this.source = terrain;
    const map = buildTerrainMesh(terrain, MAP_SUBDIV);
    const surround = buildTerrainMesh(terrain, 1);
    const cols = surround.xs.length, rows = surround.ys.length;
    this.meshes = {
      map: this.upload(map, [map.indices]),
      surround: this.upload(surround, SURROUND_STRIDES.map((s) => lodIndices(cols, rows, s))),
    };
    return this.meshes;
  }

  /** One vertex buffer, and a VAO per index list over it. */
  private upload(cpu: TerrainMesh, lists: readonly Uint32Array[]): GpuMesh {
    const gl = this.gl;
    const vbo = staticBuffer(gl, gl.ARRAY_BUFFER, cpu.vertices);
    const draws = lists.map((indices) => {
      const vao = gl.createVertexArray();
      gl.bindVertexArray(vao);
      gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
      vertexLayout(gl, [3, 3]);
      const ibo = staticBuffer(gl, gl.ELEMENT_ARRAY_BUFFER, indices);
      gl.bindVertexArray(null);
      return { vao, ibo, count: indices.length };
    });
    return { vbo, cpu, draws };
  }

  private release(mesh: GpuMesh): void {
    for (const d of mesh.draws) {
      this.gl.deleteVertexArray(d.vao);
      this.gl.deleteBuffer(d.ibo);
    }
    this.gl.deleteBuffer(mesh.vbo);
  }

  /** Returns how many fields were written. Always at least one slot so the upload is never empty. */
  private packFields(fields: readonly ResourceField[]): number {
    const n = Math.min(fields.length, MAX_FIELDS);
    const d = this.fields;
    for (let i = 0; i < n; i++) {
      const f = fields[i]!;
      d[i * 4] = f.x;
      d[i * 4 + 1] = f.y;
      d[i * 4 + 2] = f.radius;
      d[i * 4 + 3] = f.amount / FIELD_AMOUNT;
    }
    return Math.max(1, n);
  }
}
