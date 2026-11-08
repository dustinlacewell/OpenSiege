Source: apps/client/src/render/featuresPass.ts, featureMeshes.ts, wreckForm.ts, wreckMeshes.ts, treeMeshes.ts, rockMeshes.ts, meshBlob.ts, featureInstance.ts, featureWatch.ts, propProgram.ts, propBatch.ts, propShader.ts, propMaterials.ts, propInstance.ts

# Features

`FeaturesPass` draws `world.features`: the map kinds (rocks, boulders, trees) and the scrap and wreckage that dead units leave (`sim/features/wreckage.md`). Vision never hides them: they are map knowledge, like the terrain. They cast and receive sun shadows.

## Static props

Features and ground scatter (`client/render/scatter.md`) share one static-prop path.

- `PropProgram`: the lit and depth programs, built once in `Renderer` and passed to both passes. `draw(batches, cam, sun, fade)` and `drawDepth(batches, lightViewProj, fade)`.
- `PropBatch`: one model (static vertex buffer, layout `[3, 3, 1]` as for units) plus its `InstanceBuffer` and VAO.
- Instance floats (`PROP_STRIDE` = 7): `x, y, z, yaw` | `footprint scale, height scale, tint`. Locations 3 (vec4) and 4 (vec3). `writeProp` packs a `PropInstance`.
- Models are 1 wide (radius) and 1 tall. The vertex shader (`PROP_VS`) scales x and y by the footprint scale and z by the height scale, corrects normals for the stretch, turns by yaw and adds the position.
- `u_fade` (centre x, y · start · end): a prop shrinks to nothing between start and end. Features pass `NO_FADE`.
- Colour comes from `propMaterials.ts`: a table of materials (colour, foot darkening, per-face brightness spread, sun highlight). A vertex's `part` is an index into it, and `PART.<name>` gives the index. The table is also emitted as GLSL constants, so there is one source. The fragment shader (`PROP_FS`) lights with `lit`, `specular`, `sunShadow` and `fogged`. Tint varies brightness by ±12% per instance.

## Models

Built in code with `MeshBuilder` (`client/render/unit-meshes.md`), flat-shaded. `FeaturesPass.batchFor(feature)` picks the model.

- Map kinds: `FEATURE_MESHES[kind]` lists one builder per variant. A feature's `variant` picks one (wrapped by the list length), so a new map kind or variant is one entry there.
- Scrap and wreckage (`isWreck`, `wreckForm.ts`): one model per unit kind and form, `wreckModel(unit, form)` (`client/render/wreck-meshes.md`). The feature's `unit` picks it. `variant` is not used. A wreck with no `unit` is not drawn.

| Kind | Variants (triangles) |
|---|---|
| tree | spruce 76, pine 80, oak 140, broadleaf 60 |
| rock | dome 80, spire 100, slab 100, cluster 60 |
| boulder | round 80, low 80, pair 40, mossy 80 |
| scrap, wreckage | one per unit kind, 376 to 1644 |

- Trees: a six-sided trunk and either stacked cones (`MeshBuilder.cone`) or leafy lumps. The crown spreads to 1.5 to 1.9 radii, so leaves overhang the feature's `radius`.
- Rocks and boulders: `blob` (`meshBlob.ts`), a jittered icosphere (20 or 80 faces) stretched to an ellipsoid, foot cut flat and sunk 2 to 5% below the ground. Jitter is noise of the unit-sphere point, so shared corners agree and there are no cracks. Rocks are craggier and grey or brown; boulders are rounder and smaller.

## Placing instances

`featureInstance(feature, terrain, out)` is pure.

- Position: the feature's x, y. Height: the lowest `heightAt` of the centre and four points at 0.6 radius, so on a slope the uphill side is buried, never floating.
- Scale: footprint = `radius`. Height for a map kind = `FEATURE_STATS[kind].height`. Height for a wreck = `UNIT_STATS[unit].height` times `WRECK_HEIGHT[form]` (scrap 1, wreckage 0.3). All heights get a spread of ±10% from the position.
- Yaw and tint: hashes of the position (`game/hash01.ts`). Every client draws the same forest. Not the id: the map editor renumbers ids on every erase, and a feature must keep its look.

## Rebuilding

`FeaturesPass.prepare(world)` asks `FeatureWatch` whether anything changed. The watch compares the terrain object, the feature count, the first and last feature id and the field count. Only on a change does it clear every batch, rewrite all instances and upload. Every other frame it does nothing.

The check is exact for sim changes because `world.features` is sorted by id and new ids only grow. A removal changes the count. An addition changes the last id: a death adds scrap or wreckage, and scrap turning to wreckage is a removal plus an addition. A new world changes the terrain or the first id.

## Passes

- `prepare(world)`: in `Renderer.prepare`.
- `drawDepth(lightViewProj)`: in `castShadows`, after terrain.
- `draw(cam, sun)`: in `drawScene`, right after the terrain and scatter, before ground decals.

## Invariants

- Instance stride is `PROP_STRIDE`; the attribute sizes are `4 + 3`.
- The depth pass uses the same vertex shader as the lit pass.
- All instances are drawn every frame. There is no per-frame culling. Cost is vertex work for the whole feature set, twice (sun and scene).
- The minimap marks each feature as a one-pixel dark speck (`ui/minimap.ts`).
