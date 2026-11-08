Source: apps/client/src/audio/worldEvents.ts, apps/client/src/game/shotTracker.ts

# Impact choice

A shell that vanished makes one of four sounds. `impactCue(source, x, y, bodies)` picks it. It is pure.

- Family: the firer's weapon, `UNIT_STATS[source].weapon`. `ballistic` is a shell (`shell*`). Any other is a round (`round*`).
- Surface: armor when any body has its centre within its hit radius + 8 world units of the burst. Otherwise ground. The hit radius is `UNIT_STATS[kind].radius`, the circle the sim tests shells against (`packages/sim/src/systems/projectiles.ts`, `bodyAt`).
- The burst point is the shell's next position, as `Effects` places the flash.

`ShotState.source` carries the firer's kind, copied from `Projectile.source` by `ShotTracker`.

`diffWorld` passes as bodies every unit in the world now plus every unit destroyed this step (in the last marks, gone now), at its last position. Owner does not matter. A shell that kills its target still sounds on armor.
