Source: apps/client/src/game/gunPitch.ts

# Gun pitch

The sim gives each unit `elevation`: the gun's slope in permille (rise per 1000 run). Combat sets it every tick for the tank and the artillery. It is 0 when no shot is solved. The sim fires from the barrel as it stood at the start of the tick: world aim bearing and slope from the previous tick (`sim/src/muzzle.ts`, `sim/systems/combat.md`). That is the barrel the client draws at the start of the step's interpolation. The client draws every barrel along its world aim bearing and slope.

`gunPose(permille, rest, aim, hull)` returns `{ gun, swing }`. `hull` is the pose's `yaw`, `pitch` and `roll`.

1. It builds the world barrel direction: bearing `aim`, elevation `atan(permille / 1000)`.
2. It moves that direction into the hull frame. It undoes the yaw, then the shader's `tilt` in reverse order: pitch, then roll.
3. `gun` is the elevation of that direction above the hull plane, clamped to −30° … +85° (`GUN_MIN`, `GUN_MAX`), less `rest`. The clamp keeps a bad value from folding the barrel into the hull or past vertical. The artillery lobs up to about 80°.
4. `swing` is the bearing of that direction in the hull frame, less the turret turn `aim − yaw`. It is clamped to ±45° (`SWING_MAX`). On flat ground it is 0.

The swing is needed because the slope tilt turns a barrel that points across the tilt to one side. The turret and the barrel pivot keep the turret turn, as the sim places the pivot. Only the barrel turns the extra `swing` about its pivot.

`rest` is the sim's `gunRest` in radians (`restElevation(kind)` in `game/muzzle.ts`): 0 for the tank, 35° for the artillery. The mesh is modelled at `rest`, so a shot at the rest elevation on flat ground draws the mesh as modelled.

Signs agree with the unit shader: positive hull pitch raises +x, positive roll raises +y, positive gun pitch raises the muzzle, positive swing turns toward +y (`client/render/units.md`).

`fillPoses` writes the result into `UnitPose.gun` and `UnitPose.swing` for every unit. Only meshes with a `gun` pivot draw them. With no shot, `elevation` is 0, so a barrel points level in the world.

`test/barrelTip.test.ts` checks the drawn barrel tip against the sim's `muzzleTip` on flat ground and on a 15° slope. It uses a hand copy of the shader in `test/support/unitVertex.ts`.
