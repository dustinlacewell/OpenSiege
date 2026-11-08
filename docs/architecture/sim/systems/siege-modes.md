Source: packages/sim/src/systems/modes.ts, packages/sim/src/siege.ts, packages/sim/src/orders.ts, packages/sim/src/intents.ts, packages/sim/src/units.ts, packages/sim/src/weapons.ts, packages/sim/src/damage.ts

# Siege modes

Every unit has a `mode`: `mobile`, `deploying`, `sieged`, `packing`.

```
mobile -> deploying -> sieged -> packing -> mobile
```

## Transitions

- Siege is an order: `siege {on}` in `Unit.orders` (`sim/orders.md`). The `siege` intent only gives the order. `modes()` runs each tick and acts on the head order. Helpers are in `siege.ts`: `isAnchored` (sieged or deploying), `startDeploying`, `startPacking`.
- `siege {on: true}` at the head: a `mobile` unit with `siegeTicks > 0` goes to `deploying` with `modeTimer = siegeTicks`. The order is done once the unit is `sieged`. A kind with `siegeTicks <= 0` drops the order. In `deploying` or `packing` the order waits.
- `siege {on: false}` at the head: a `sieged` or `deploying` unit goes to `packing`, `modeTimer = siegeTicks`. A `deploying` unit restarts the timer at the full value. The order is done once the unit is `mobile`. A mobile unit finishes it at once. In `packing` it waits.
- A `move` at the head of an anchored unit: `modes` starts `packing`. Movement takes over once the unit is `mobile`.
- A `guard` at the head of an anchored unit that has to move: `movement` starts `packing`, the same rule as a move (`sim/systems/guard.md`). A guard that does not have to move stays sieged. Guards never deploy on their own.
- A replacing `move` on an anchored unit starts `packing` in the intent itself. A queued move waits in the queue until it is the head (`sim/intents.md`).- Each tick `modes()` decrements `modeTimer` of `deploying` and `packing` units. At 0, `deploying` becomes `sieged` and `packing` becomes `mobile`.
- `stop` clears the orders but does not cancel a deploy or pack. The timer keeps running.

## What the mode changes

- Movement and arrival: only `mobile` units move or arrive.
- Weapon: `weaponOf` returns the mobile stats when `mobile`, the siege stats when `sieged`, and nothing while deploying or packing. Turrets still turn.
- Armor: `applyDamage` multiplies damage by `siegeArmor / 100` when `sieged`.
- Work: `workRateOf` is `workRate` when mobile, `siegeWorkRate` when sieged, 0 in transition. Factories, harvesters and engineers use it.
- Separation: any non-mobile unit is an anchor and never gets pushed.
- Engineers: mobile heals one patient, sieged heals all in `workRange` (`sim/systems/repair.md`).
- Radar: `radarRange` is `siegeRadar` when sieged, else `radar`. Only the client reads it. The radar truck goes from 3500 to 5500.

## Client reads

`game/poses.ts` turns `mode` and `modeTimer` into a 0..1 `siege` value for the model fold and the mast raise. `ui/queueModel.ts` shows the factory speed tag from the mode. `game/vision.ts` reads `radarRange`.

## Add a mode-dependent stat

Add the field to `UnitStats` (`sim/stats.md`). Read it by mode where the rule runs, as `weaponOf` and `workRateOf` do. Do not branch on `mode` in many places. Put the choice in one helper.
