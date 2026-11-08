import { mapSize, type Terrain, type VertexBox } from "@mf/sim";
import { createPoseTable, fillPoses } from "../game/poses.ts";
import { holdShellLights } from "../game/shellLights.ts";
import { SmokeField } from "../game/smoke.ts";
import { keepVisible } from "../game/visiblePoses.ts";
import { BillboardProgram } from "./billboards.ts";
import { ContactShadowsPass } from "./contactShadows.ts";
import { DecalMap } from "./decalMap.ts";
import { EffectsPass } from "./effects.ts";
import { FeaturesPass } from "./featuresPass.ts";
import type { Frame } from "./frame.ts";
import { FullscreenTriangle } from "./fullscreen.ts";
import { createContext, createQuad, fitCanvas } from "./gl.ts";
import { HdrTarget } from "./hdrTarget.ts";
import { LightTextures } from "./lightTextures.ts";
import { OverlayPass } from "./overlay.ts";
import { PortraitRenderer } from "./portraits.ts";
import { PostPass } from "./postPass.ts";
import { PropProgram } from "./propProgram.ts";
import { ProjectilesPass } from "./projectiles.ts";
import { WorkBeamsPass } from "./workBeams.ts";
import { RadarPass } from "./radarPass.ts";
import { RipplePass } from "./ripples.ts";
import { ScatterPass } from "./scatterPass.ts";
import { ShadowMap } from "./shadowMap.ts";
import { SkyPass } from "./skyPass.ts";
import { SmokePass } from "./smokePass.ts";
import { TeamColors } from "./teamColors.ts";
import { TerrainPass } from "./terrain.ts";
import { UnitsPass } from "./units.ts";
import { WaterPass } from "./water.ts";

/**
 * Orchestrates a frame: new scorches into the decal map, sun shadow map, the ripple step, then the HDR multisampled scene (sky, ground,
 * ground cover and features, marks, units, a grab of all that, the water, smoke, light), then tone mapping onto the canvas, then screen marks.
 */
export class Renderer {
  private readonly gl: WebGL2RenderingContext;
  private readonly hdr: HdrTarget;
  private readonly shadowMap: ShadowMap;
  private readonly decals: DecalMap;
  private readonly sky: SkyPass;
  private readonly terrain: TerrainPass;
  private readonly scatter: ScatterPass;
  private readonly features: FeaturesPass;
  private readonly contact: ContactShadowsPass;
  private readonly units: UnitsPass;
  private readonly ripples: RipplePass;
  private readonly water: WaterPass;
  private readonly smoke: SmokePass;
  private readonly projectiles: ProjectilesPass;
  private readonly effects: EffectsPass;
  private readonly workBeams: WorkBeamsPass;
  private readonly radar: RadarPass;
  private readonly overlay: OverlayPass;
  private readonly post: PostPass;
  /** Unit headshots for the HUD, in the local player's colour. */
  readonly portraits: PortraitRenderer;
  private readonly poses = createPoseTable();
  private readonly teams = new TeamColors();
  private readonly smokeField = new SmokeField();
  private readonly lights: LightTextures;

  constructor(private readonly canvas: HTMLCanvasElement) {
    const gl = createContext(canvas);
    this.gl = gl;
    const quad = createQuad(gl);
    const tri = new FullscreenTriangle(gl);
    const billboards = new BillboardProgram(gl);
    this.hdr = new HdrTarget(gl);
    this.shadowMap = new ShadowMap(gl);
    this.lights = new LightTextures(gl);
    this.sky = new SkyPass(gl, tri);
    this.decals = new DecalMap(gl, quad);
    this.terrain = new TerrainPass(gl, tri, this.decals.texture);
    const props = new PropProgram(gl);
    this.scatter = new ScatterPass(gl, props);
    this.features = new FeaturesPass(gl, props);
    this.contact = new ContactShadowsPass(gl, quad);
    this.units = new UnitsPass(gl);
    this.ripples = new RipplePass(gl);
    this.water = new WaterPass(gl, tri);
    this.smoke = new SmokePass(gl, quad);
    this.projectiles = new ProjectilesPass(gl, quad, billboards);
    this.effects = new EffectsPass(gl, quad, billboards);
    this.workBeams = new WorkBeamsPass(gl, quad, billboards);
    this.radar = new RadarPass(gl, quad, billboards);
    this.overlay = new OverlayPass(gl, quad);
    this.post = new PostPass(gl, tri);
    this.portraits = new PortraitRenderer(gl, this.units, this.post, this.shadowMap.texture);
  }

  /** Call each frame. Resizes the drawing buffer when the CSS size or dpr changed. */
  fit(dpr: number): void {
    fitCanvas(this.canvas, dpr);
  }

  /** The heights in this vertex box changed in place: the ground mesh, the water's height map, ground cover and features follow. */
  refreshTerrain(terrain: Terrain, box: VertexBox): void {
    this.terrain.updateMesh(terrain, box);
    this.water.refresh(terrain, box);
    this.scatter.refresh(terrain, box);
    this.features.refresh(terrain, box);
  }

  draw(f: Frame): void {
    this.prepare(f);
    this.castShadows(f);
    this.ripples.update(f, f.world.terrain);
    this.hdr.begin(this.gl.drawingBufferWidth, this.gl.drawingBufferHeight);
    this.drawScene(f);
    this.hdr.resolve();
    this.post.draw(this.hdr.texture, this.gl.drawingBufferWidth, this.gl.drawingBufferHeight);
    this.overlay.drawScreen(f, this.poses);
  }

  /** Per-frame state every pass reads: seen poses, team colours, headshots, instances, smoke, seen scorches, lights. Features are not filtered by vision. */
  private prepare(f: Frame): void {
    fillPoses(this.poses, f.world, f.prev, f.alpha);
    keepVisible(this.poses, f.vision);
    this.teams.use(f.world.players);
    this.portraits.update(this.teams.of(f.me));
    this.units.prepare(this.poses, this.teams);
    this.features.prepare(f.world);
    this.scatter.prepare(f.world, f.cam);
    this.smokeField.update(f.world, f.time);
    this.smoke.fill(this.smokeField, f.vision);
    this.decals.update(f.world, this.smokeField.stamps, f.vision);
    this.shadowMap.fit(f.cam, mapSize(f.world.terrain));
    this.gatherLights(f);
  }

  /** Last frame's held lights go; shells and beams hold theirs; then the strongest seen lights bin into the scene target's tiles. */
  private gatherLights(f: Frame): void {
    f.lights.beginFrame();
    holdShellLights(f.lights, f.world.projectiles, f.prevShots, f.alpha);
    this.workBeams.prepare(this.poses, f.world.features, f.world.terrain, f.lights, f.time);
    const gl = this.gl;
    this.lights.fill(f.lights, f.vision, { viewProj: f.cam.viewProj, width: gl.drawingBufferWidth, height: gl.drawingBufferHeight });
  }

  private castShadows(f: Frame): void {
    this.shadowMap.begin();
    this.terrain.drawDepth(f.world.terrain, this.shadowMap.viewProj);
    this.features.drawDepth(this.shadowMap.viewProj);
    this.units.drawDepth(this.shadowMap.viewProj, f.time);
    this.shadowMap.end();
  }

  private drawScene(f: Frame): void {
    const sun = this.shadowMap;
    const lights = this.lights;
    this.sky.draw(f.cam, sun);
    this.terrain.draw(f.world.terrain, f.world.fields, f.cam, sun, lights, f.time);
    this.scatter.draw(f.cam, sun, lights);
    this.features.draw(f.cam, sun, lights);
    this.contact.draw(this.poses, f.cam);
    this.overlay.drawGround(f, this.poses);
    this.radar.draw(f.vision, f.world.terrain, this.teams, f.cam, f.time);
    this.units.draw(f.cam, sun, lights, f.time);
    this.water.draw(f.world.terrain, f.cam, sun, lights, this.hdr.grab(), this.ripples.texture, f.time);
    this.smoke.drawPuffs(f.cam);
    this.projectiles.draw(f.world.projectiles, f.prevShots, f.alpha, f.cam, f.vision);
    this.workBeams.draw(f.cam, f.time);
    this.effects.draw(f.particles, f.cam, f.vision);
  }
}
