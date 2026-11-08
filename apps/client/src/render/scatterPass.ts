import type { Terrain, VertexBox, World } from "@mf/sim";
import type { Camera } from "../game/camera.ts";
import { unionBox } from "../game/terrainWatch.ts";
import { FeatureWatch } from "./featureWatch.ts";
import { PropBatch } from "./propBatch.ts";
import { writeProp } from "./propInstance.ts";
import type { Fade, PropProgram } from "./propProgram.ts";
import { placeScatter } from "./scatterCells.ts";
import { refreshScatterMask, scatterMask } from "./scatterMask.ts";
import { SCATTER_MESHES } from "./scatterMeshes.ts";
import { fadeStart, sameView, scatterView, scatterVisible, type ScatterView } from "./scatterView.ts";
import type { SceneLights, SunLight } from "./scene.ts";

/** Most props in the window at once. Past it the far cells are left bare. */
export const SCATTER_LIMIT = 8000;

/**
 * Grass, pebbles and bushes on the ground near the camera. Client only: placed from the terrain and
 * the features, never sent. Instanced, shrunk to nothing with distance, no shadows cast. The window
 * rebuilds when the camera crosses to a new block, the zoom band changes, or the features change.
 */
export class ScatterPass {
  private readonly batches: PropBatch[];
  private readonly watch = new FeatureWatch();
  private mask: Uint8Array = new Uint8Array(0);
  private dirty: VertexBox | null = null;
  private built: ScatterView | null = null;
  private view: ScatterView | null = null;
  private readonly fade: Fade = { x: 0, y: 0, start: 0, end: 0 };

  constructor(gl: WebGL2RenderingContext, private readonly props: PropProgram) {
    this.batches = SCATTER_MESHES.map((build) => new PropBatch(gl, build(), 512));
  }

  /** The heights in this vertex box changed in place. The next `prepare` redoes the mask there and rebuilds the instances. */
  refresh(_terrain: Terrain, box: VertexBox): void {
    this.dirty = this.dirty ? unionBox(this.dirty, box) : box;
  }

  /** Rebuilds the instances if the window or the ground cover inputs changed. Call once before `draw`. */
  prepare(world: World, cam: Camera): void {
    const maskChanged = this.watch.changed(world);
    if (maskChanged) {
      this.mask = scatterMask(world);
      this.built = null;
      this.dirty = null;
    } else if (this.dirty) {
      refreshScatterMask(this.mask, world, this.dirty);
      this.built = null;
      this.dirty = null;
    }
    if (!scatterVisible(cam.dist)) {
      this.view = null;
      return;
    }
    const view = scatterView(cam.x, cam.y, cam.dist);
    this.view = view;
    if (this.built && sameView(this.built, view)) return;
    this.built = view;
    this.rebuild(world, view);
  }

  draw(cam: Camera, sun: SunLight, lights: SceneLights): void {
    const view = this.view;
    if (!view) return;
    const fade = this.fade;
    fade.x = cam.x;
    fade.y = cam.y;
    fade.start = fadeStart(view);
    fade.end = view.fadeEnd;
    this.props.draw(this.batches, cam, sun, lights, fade);
  }

  private rebuild(world: World, view: ScatterView): void {
    for (const b of this.batches) b.instances.reset();
    placeScatter(world.terrain, this.mask, view, SCATTER_LIMIT, (kind, prop) => {
      const batch = this.batches[kind]!;
      const o = batch.instances.push();
      writeProp(batch.instances.data, o, prop);
    });
    for (const b of this.batches) b.upload();
  }
}
