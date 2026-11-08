import { UNIT_KINDS, type Feature, type MapFeatureKind, type Terrain, type UnitKind, type VertexBox, type World } from "@mf/sim";
import { FeatureWatch } from "./featureWatch.ts";
import { featureInstance } from "./featureInstance.ts";
import { FEATURE_MESHES, MAP_FEATURE_KINDS, variantIndex } from "./featureMeshes.ts";
import { PropBatch } from "./propBatch.ts";
import { createPropInstance, writeProp } from "./propInstance.ts";
import { NO_FADE, type PropProgram } from "./propProgram.ts";
import type { SceneLights, SceneView, SunLight } from "./scene.ts";
import { isWreck, WRECK_FORMS, type WreckForm } from "./wreckForm.ts";
import { wreckModel } from "./wreckMeshes.ts";

/**
 * The map's rocks, boulders and trees, and the scrap and wreckage dead units leave: one instanced draw
 * per map kind and variant, and per unit kind and wreck form. Lit into the scene and depth into the
 * shadow map. Instances rebuild only when the feature set changes. Vision never hides them: they are
 * map knowledge, like the terrain.
 */
export class FeaturesPass {
  private readonly maps: Record<MapFeatureKind, PropBatch[]>;
  private readonly wrecks: Record<UnitKind, Record<WreckForm, PropBatch>>;
  private readonly all: PropBatch[];
  private readonly watch = new FeatureWatch();
  private readonly scratch = createPropInstance();
  private groundChanged = false;

  constructor(gl: WebGL2RenderingContext, private readonly props: PropProgram) {
    this.maps = Object.fromEntries(
      MAP_FEATURE_KINDS.map((kind) => [kind, FEATURE_MESHES[kind].map((build) => new PropBatch(gl, build()))]),
    ) as Record<MapFeatureKind, PropBatch[]>;
    this.wrecks = Object.fromEntries(UNIT_KINDS.map((unit) => [unit, Object.fromEntries(
      WRECK_FORMS.map((form) => [form, new PropBatch(gl, wreckModel(unit, form))]),
    )])) as Record<UnitKind, Record<WreckForm, PropBatch>>;
    this.all = [
      ...MAP_FEATURE_KINDS.flatMap((kind) => this.maps[kind]),
      ...UNIT_KINDS.flatMap((unit) => WRECK_FORMS.map((form) => this.wrecks[unit][form])),
    ];
  }

  /**
   * The heights in a vertex box changed in place. Every feature's foot is re-read at the next `prepare`:
   * the full rebuild costs one pass over the features (a few ground probes each), so the box is not used.
   */
  refresh(_terrain: Terrain, _box: VertexBox): void {
    this.groundChanged = true;
  }

  /** Rewrites and uploads the instances if the features changed. Call once before `drawDepth` and `draw`. */
  prepare(world: World): void {
    const changed = this.watch.changed(world);
    if (!changed && !this.groundChanged) return;
    this.groundChanged = false;
    for (const b of this.all) b.instances.reset();
    for (const f of world.features) {
      const batch = this.batchFor(f);
      if (!batch) continue;
      featureInstance(f, world.terrain, this.scratch);
      const o = batch.instances.push();
      writeProp(batch.instances.data, o, this.scratch);
    }
    for (const b of this.all) b.upload();
  }

  /** A wreck's model is its unit's and form's; a map feature's is its kind's, picked by variant. A wreck with no unit is not drawn. */
  private batchFor(f: Feature): PropBatch | undefined {
    if (isWreck(f.kind)) return f.unit === undefined ? undefined : this.wrecks[f.unit][f.kind];
    const models = this.maps[f.kind];
    return models[variantIndex(f.variant, models.length)];
  }

  /** Into the bound shadow map. */
  drawDepth(lightViewProj: Float32Array): void {
    this.props.drawDepth(this.all, lightViewProj, NO_FADE);
  }

  draw(cam: SceneView, sun: SunLight, lights: SceneLights): void {
    this.props.draw(this.all, cam, sun, lights, NO_FADE);
  }
}
