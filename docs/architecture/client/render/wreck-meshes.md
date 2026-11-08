Source: apps/client/src/render/wreckMeshes.ts, wreckForm.ts, featureInstance.ts, propMaterials.ts

# Wreck models

`wreckModel(unit, form)` builds the model of the scrap or wreckage a dead unit leaves. It starts from the unit's own mesh (`UNIT_MESHES[unit]().vertices`). It is pure and deterministic: no `Math.random`, no GL. `FeaturesPass` builds the 14 models (7 units, 2 forms) once.

## Scale

Unit meshes are in world units. The unit shader adds the position and turns the mesh, but does not scale it. So mesh space is sim space.

The model is a normalised prop model (`client/render/features.md`): x and y divide by the unit's sim `radius`, z by its sim `height` (`UNIT_STATS`). `featureInstance` multiplies back: footprint by the feature's `radius` (the unit's radius), height by the unit's height times `WRECK_HEIGHT[form]`. So scrap is drawn the size of the dead unit, and wreckage is 0.3 of its height.

Before the divide, the model shrinks evenly (never grows) until it fits 1.15 radii across and 1.05 heights up. Barrels and folded masts can reach past the sim radius.

Normals take the inverse stretch of the divide.

## Steps

Each triangle of the unit mesh goes through these steps, in this order:

1. Drop: parts in the form's drop list (`scrapDrop` or `wreckDrop`) go.
2. Pose: as the unit shader draws a mobile unit (siege 0). Legs draw in to 0.6 and lift by `legLift`. Mast and dish fold about the mesh's `mast` hinge.
3. Cut: parts in `cut.parts` pull in to `cut.reach` radii of the centre and down to `cut.top` heights. A barrel becomes a stub.
4. Dent: each corner moves by noise of its original spot (`hash01`), so shared corners move together and there are no cracks. Dents push down.
5. Lean: the model turns `tilt` degrees about a ground axis, toward direction `lean`.
6. Sink: the model drops `sink` heights into the ground.

The faces are then flat-shaded. Triangles that a cut crushed to nothing are dropped.

## Forms

- Scrap: the unit's hull, broken. Full tilt, sink and dent. Scrap materials.
- Wreckage: fewer parts, dents twice as deep, a third of the tilt, half the sink. `featureInstance` squashes it to 0.3 of the unit's height. A rubble mound (`blob`, `meshBlob.ts`) of soot sits under the hull, `mound` model units high. Charred materials.

## Materials

Each unit part maps to a prop material (`propMaterials.ts`). The table is per form, not per unit.

- Scrap: hull and turret are `scrapRust`. Panels and dish are `scrapSteel`. Tracks, dark parts, legs, lights and mast are `scrapScorched`.
- Wreckage: hull, turret, panels and dish are `ember`. The rest and the mound are `soot`.

## The style table

`WRECK_STYLE` has one row per unit kind: `tilt`, `lean`, `sink`, `dent`, `scrapDrop`, `wreckDrop`, `cut`, `mound`, `seed`. The logic has no switch on unit kind.

To add a unit, add its row. The test `wreckMeshes.test.ts` checks every unit and form: valid parts, finite, in bounds, deterministic, all scrap models different, wreckage lower than scrap.
