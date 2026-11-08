Source: packages/sim/src/fireable.ts, packages/sim/src/launch.ts

# Fireable

`canFire(world, u, t)` is true when `u` is armed (`weaponOf`) and its gun has a firing solution on `t`. It is pure.

- `direct` and `ballistic`: `aim` (`launch.ts`), the plan with the barrel on the bearing, must find an arc. Combat fires from the barrel as it stands (`aimFrom`), which can still hold fire for a tick (`sim/systems/combat.md`). A direct arc must clear the terrain within `maxPitch`, so a hill can block it. A ballistic arc always exists.
- `mine`: always true. A mine fires no shell.

It does not test range or `minRange`. That is `reach` (`sim/targeting.md`). A caller that picks a target asks both.

## Callers

- `combat`: the guard pick and the nearest-enemy pick (`sim/systems/combat.md`).
- `engage`: the start and the keep test (`sim/systems/engage.md`).

## Cost

`aim` re-solves up to 8 times, and a direct solve replays the shell flight. Callers pass `canFire` as an `accept` filter, so it runs only for a candidate that would beat the best so far.
