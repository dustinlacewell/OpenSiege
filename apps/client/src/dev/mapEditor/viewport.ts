import { mapSize, type Terrain, type World } from "@mf/sim";
import type { EditorMap, Palette, VertexRect } from "@mf/map";
import type { Camera } from "../../game/camera.ts";
import { ring, type LineStyle } from "../../game/groundLines.ts";
import { DecalMap } from "../../render/decalMap.ts";
import { FeaturesPass } from "../../render/featuresPass.ts";
import { FullscreenTriangle } from "../../render/fullscreen.ts";
import { createContext, createQuad, fitCanvas } from "../../render/gl.ts";
import { decal } from "../../render/glState.ts";
import { HdrTarget } from "../../render/hdrTarget.ts";
import { LineBatch } from "../../render/lines.ts";
import type { MaterialPalette } from "../../render/materialPalette.ts";
import { createMaterialTexture, type MaterialTexture } from "../../render/materialTexture.ts";
import { PostPass } from "../../render/postPass.ts";
import { PropProgram } from "../../render/propProgram.ts";
import { ScatterPass } from "../../render/scatterPass.ts";
import { NO_LIGHTS } from "../../render/scene.ts";
import { ShadowMap } from "../../render/shadowMap.ts";
import { SkyPass } from "../../render/skyPass.ts";
import { TerrainPass } from "../../render/terrain.ts";
import { WaterPass } from "../../render/water.ts";
import type { Ring, RingKind } from "./cursorRings.ts";

const RING_STYLES: Record<RingKind, LineStyle> = {
  brush: { r: 1.0, g: 0.82, b: 0.34, a: 0.9, widthPx: 2 },
  profile: { r: 1.0, g: 0.82, b: 0.34, a: 0.9, widthPx: 1.5 },
  add: { r: 0.85, g: 1.0, b: 0.9, a: 0.8, widthPx: 1.5 },
  remove: { r: 1.0, g: 0.35, b: 0.3, a: 0.9, widthPx: 2 },
  density: { r: 1.0, g: 0.82, b: 0.34, a: 0.55, widthPx: 1.5 },
};
const SEGMENTS: Record<RingKind, number> = { brush: 96, profile: 96, add: 24, remove: 24, density: 6 };

/**
 * The editor's view of the map: the game's sky, terrain, ground cover, features and calm water (no ripples), lit by the sun
 * with no point lights, plus the brush ring. The game's `Renderer` draws a match frame; this draws only what a map has.
 */
export class Viewport {
  private readonly gl: WebGL2RenderingContext;
  private readonly hdr: HdrTarget;
  private readonly shadowMap: ShadowMap;
  private readonly sky: SkyPass;
  private readonly terrain: TerrainPass;
  private readonly scatter: ScatterPass;
  private readonly features: FeaturesPass;
  private readonly water: WaterPass;
  private readonly lines: LineBatch;
  private readonly post: PostPass;
  private material: MaterialTexture | null = null;

  constructor(private readonly canvas: HTMLCanvasElement) {
    const gl = createContext(canvas, true);
    this.gl = gl;
    const quad = createQuad(gl);
    const tri = new FullscreenTriangle(gl);
    this.hdr = new HdrTarget(gl);
    this.shadowMap = new ShadowMap(gl);
    this.sky = new SkyPass(gl, tri);
    // Never stamped: the terrain reads its clean texture.
    const decals = new DecalMap(gl, quad);
    this.terrain = new TerrainPass(gl, tri, decals.texture);
    const props = new PropProgram(gl);
    this.scatter = new ScatterPass(gl, props);
    this.features = new FeaturesPass(gl, props);
    this.water = new WaterPass(gl, tri);
    this.lines = new LineBatch(gl, quad);
    this.post = new PostPass(gl, tri);
  }

  /** A new map: a fresh weight texture with the whole layer, and its palette. */
  setMap(map: EditorMap): void {
    this.material?.dispose();
    const { width, height, cell } = map.spec;
    this.material = createMaterialTexture(this.gl, width / cell + 1, height / cell + 1);
    this.material.upload(map.materials.weights);
    this.setPalette(map.palette);
  }

  setPalette(palette: Palette): void {
    if (this.material) this.terrain.setMaterials({ texture: this.material.texture, palette: srgbOf(palette) });
  }

  /** Sends only the vertex rectangle a dab touched. */
  uploadMaterials(weights: Uint8Array, rect: VertexRect): void {
    this.material?.uploadRect(weights, rect);
  }

  /** The heights in `rect` changed in place: only the mesh rows that read them are rewritten, and only that part of the water's height map. */
  updateMesh(terrain: Terrain, rect: VertexRect): void {
    this.terrain.updateMesh(terrain, rect);
    this.water.refresh(terrain, rect);
  }

  /** Call each frame. Resizes the drawing buffer when the CSS size or dpr changed. */
  fit(dpr: number): void {
    fitCanvas(this.canvas, dpr);
  }

  draw(world: World, cam: Camera, cursor: readonly Ring[], dpr: number, time: number): void {
    this.prepare(world, cam);
    this.castShadows(world);
    const gl = this.gl;
    this.hdr.begin(gl.drawingBufferWidth, gl.drawingBufferHeight);
    this.drawScene(world, cam, cursor, dpr, time);
    this.hdr.resolve();
    this.post.draw(this.hdr.texture, gl.drawingBufferWidth, gl.drawingBufferHeight);
  }

  private prepare(world: World, cam: Camera): void {
    this.features.prepare(world);
    this.scatter.prepare(world, cam);
    this.shadowMap.fit(cam, mapSize(world.terrain));
  }

  private castShadows(world: World): void {
    this.shadowMap.begin();
    this.terrain.drawDepth(world.terrain, this.shadowMap.viewProj);
    this.features.drawDepth(this.shadowMap.viewProj);
    this.shadowMap.end();
  }

  private drawScene(world: World, cam: Camera, cursor: readonly Ring[], dpr: number, time: number): void {
    const sun = this.shadowMap;
    this.sky.draw(cam, sun);
    this.terrain.draw(world.terrain, world.fields, cam, sun, NO_LIGHTS, time);
    this.scatter.draw(cam, sun, NO_LIGHTS);
    this.features.draw(cam, sun, NO_LIGHTS);
    // Before the grab, so a ring on ground under water shows through it.
    this.drawCursor(world, cam, cursor, dpr);
    this.water.draw(world.terrain, cam, sun, NO_LIGHTS, this.hdr.grab(), null, time);
  }

  private drawCursor(world: World, cam: Camera, rings: readonly Ring[], dpr: number): void {
    this.lines.reset();
    for (const c of rings) {
      if (c.alpha <= 0) continue;
      const base = RING_STYLES[c.kind];
      ring(this.lines, world.terrain, c.x, c.y, c.radius, SEGMENTS[c.kind], { ...base, a: base.a * c.alpha }, 1);
    }
    decal(this.gl);
    this.lines.draw(cam, dpr);
  }
}

function srgbOf(p: Palette): MaterialPalette {
  return [p[0].color, p[1].color, p[2].color, p[3].color];
}
