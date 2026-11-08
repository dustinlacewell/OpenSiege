Source: apps/client/src/game/autoSiege.ts

# Auto-siege

Local automation. It is not part of the sim. It sends a normal `siege {on: true}` intent for the player's own units, so every peer sees an ordinary order.

- `AutoSiege.update(world, me, active)`: once per frame, after the lockstep steps. `active` is false for a spectator or a watcher; the idle clocks reset then.
- An own unit is idle when it is `mobile`, has no orders, and its kind has `siegeTicks > 0`.
- The clock counts sim ticks (`world.tick`), so it stops when the sim stops. At `IDLE_SIEGE_TICKS` (15 seconds) the unit goes into one batched intent, and its clock restarts.
- Any order or mode change drops the unit from the idle set.
- A unit that the player unsieges by hand is sieged again after 15 more idle seconds.

The frame loop calls it (`app/frame-loop.md`). `startClient` builds it with `sendIntent`.
