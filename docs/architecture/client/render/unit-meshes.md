Source: apps/client/src/render/meshes.ts, apps/client/src/render/meshBuilder.ts, apps/client/src/render/meshParts.ts, apps/client/src/render/meshCombat.ts, apps/client/src/render/meshSupport.ts, apps/client/src/render/meshMath.ts, apps/client/src/game/muzzle.ts

# Unit meshes

Unit models are low-poly solids built in code at startup. There are no model files.

## UnitMesh

```
UnitMesh { vertices: Float32Array, legLift, base: [r, g, b], mast?: { x, z, fold } }
```

- `vertices`: triangle list, 7 floats each (position, normal, part).
- `legLift`: how far the legs rise when folded.
- `base`: hull paint, sRGB.
- `mast`: the hinge of the `MAST` and `DISH` parts. `x`, `z` in model space, `fold` in radians about +y when mobile. Negative `fold` tips the top forward. Absent when the model has no mast.

`UNIT_MESHES: Record<UnitKind, () => UnitMesh>` (`meshes.ts`) holds one builder per kind. `UnitsPass` calls each once.

## Raised parts

Legs fold down to the hull. A mast must rise up, so it has its own flags. Build `MAST` and `DISH` parts in the raised pose and set `mast`. The shader turns them down by `fold` when mobile (`client/render/units.md`). `DISH` parts also sweep about the mast axis while sieged.

The radar truck (`radar`, `meshSupport.ts`): six wheels, a sloped cab, a flat bed, small jacks. The hinge is at the rear of the bed (x -24, z 24), `fold` -90°. Mobile, the mast lies forward along the bed and the dish lies flat on top, feed horn up. Sieged, the mast stands 22 up and the dish faces back.

## Model space

+x is forward. +z is up from the ground. The origin is under the unit centre, on the ground. Yaw 0 faces `+x` (`sim/coordinates.md`). Size each model to its `UNIT_STATS.radius` and `height`, since picking and shell hits use those.

## MeshBuilder

Chainable. Flat faces get outward normals computed from the solid's centre, so winding does not matter.

- `box`, `taperedBox`, `wedge`, `bevelBox`: solids.
- `cylinder(from, to, radius, segs, part)`: smooth sides, flat caps.
- `beam(from, to, thickness, part)`: slim square bar.
- `track(...)`: stadium-shaped tread belt.
- `build()`: returns the `Float32Array`.

Every call takes a part flag.

## Part flags

`HULL` 0, `TURRET` 1, `LEG` 2, `PANEL` 3, `TRACK` 4, `DARK` 5, `TURRET_PANEL` 6, `TURRET_DARK` 7, `LIGHT` 8, `MAST` 9, `DISH` 10, `BARREL` 11, `BARREL_DARK` 12. The flag tells the shader how a vertex moves (legs, turret, barrel, mast, dish) and what it is made of. The same numbers are pasted into the GLSL from these constants, so they cannot drift.

## Shared parts (`meshParts.ts`)

`tracks`, `wheel`, `barrel`, `legs`, `hatch`. `barrel` builds from `barrelOf(kind)` in `game/muzzle.ts`. That reads the sim's `gunX`, `gunZ`, `gunLength` and `gunRest` stats, so the mesh barrel is the barrel the sim fires from. Only the tube radius is client-side. `barrel` puts the tube and sleeve in `BARREL` and the muzzle brake in `BARREL_DARK`: every barrel pitches about its breech.

## Recipe: add a model

1. Write a function returning `UnitMesh` in `meshCombat.ts` (armed) or `meshSupport.ts` (support), or a new `mesh<Group>.ts`.
2. Build it with `MeshBuilder` and shared parts. Put turret parts in `TURRET*` flags so they follow `aim`. Put a mast in `MAST` and `DISH` and set `mast`.
3. Add it to `UNIT_MESHES` in `meshes.ts`. `UnitsPass` and the portraits pick it up.
4. For a barrel, give the kind a `gunLength` above 0 in the sim stats. Use `barrel(b, barrelOf(kind)!, sleeve)` and set the mesh's `gun` to the breech `(x, z)`. Put anything that moves with the barrel (the artillery's recoil cylinders) in `BARREL` or `BARREL_DARK`. The barrel is modelled at `gunRest`. The tank and the artillery do this.

## Recipe: add a part flag

Add the constant in `meshBuilder.ts`. Handle it in `UNIT_VS` or `material()` in `unitShader.ts`. Map it in both material tables in `wreckMeshes.ts`.
