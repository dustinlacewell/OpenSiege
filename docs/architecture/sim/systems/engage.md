Source: packages/sim/src/systems/engage.ts, packages/sim/src/targeting.ts, packages/sim/src/fireable.ts, packages/sim/src/orders.ts, packages/sim/src/stats.ts

# Engage

`engage(world, grid, seen)` runs for every unit in id order, right before `combat`, on the `before` grid (`sim/tick-order.md`). It is how an attack-move stops to fight.

It starts or keeps an engage only on an enemy the team detects (`seen`, `sim/detection.md`). A mine is exempt: `detectionFor` gives it `everything`.

An attack-move never stops on its own. It always drives its route (`sim/systems/movement.md`). When an enemy is near, `engage` puts a temporary `engage {target, hold, x, y}` order in front of it. That order stops the unit at a firing position. When it ends, the attack-move is the head again and drives on.

## Tunables (`stats.ts`)

- `ENGAGE_START` (300): an attack-move looks for enemies within effective range plus this.
- `ENGAGE_END` (600): an engage ends when its target is farther than effective range plus this.
- `ENGAGE_LEASH` (900): an engage ends when the unit is farther than this from its anchor.

## Head is an attack-move

Only a `mobile` and armed unit is checked.

1. Ask `nearestEnemy` for the nearest detected enemy within effective range plus `ENGAGE_START`, no nearer than the weapon's `minRange`, that the unit `canFire` on, ignoring the id in `skip` (`sim/targeting.md`, `sim/fireable.md`). An enemy behind a hill that blocks every direct arc does not stop the unit.
2. If there is one, insert `engage {target, hold: false, x, y}` at the front of the queue. `x, y` is the unit's position now. This is the anchor. The attack-move stays behind it, unchanged.

A mine (`weapon: "mine"`) asks `densestEnemy` instead. It picks the enemy with the most detected enemies within `deathRadius` of it. A tie goes to the nearer one. A lone enemy still qualifies; a crowd beats it.

## Head is an engage

The engage ends, and is removed, in these cases:

- The target is dead or gone.
- The team no longer detects the target.
- The target is farther than effective range plus `ENGAGE_END` from the unit.
- The target is nearer than the weapon's `minRange`.
- The unit cannot fire on the target (`canFire`), for example it moved behind a hill.
- The unit is farther than `ENGAGE_LEASH` from the anchor.

The keep test is the start test with `ENGAGE_END` in place of `ENGAGE_START`. After an end, the attack-move is the head, and on the next tick it starts an engage on the next enemy that passes.

A leash end writes the target id into the `skip` field of the attack-move behind it. The search then ignores that one enemy. Without this, the target could still be close, and the unit would engage it again at once.

Otherwise the engage runs as an attack: `movement` closes on the target and holds inside the dead band, and `combat` fires at it (`sim/systems/movement.md`, `sim/systems/combat.md`).

## Why a queue entry

The queue is the only state orders have. Anything in it is hashed, saved in snapshots, shown to the player, and cleared by a stop or a new order, with no extra code. A hidden flag on the unit would need all of that written again. No resume code is needed: removing the engage makes the attack-move the head.

The queue may hold `MAX_ORDERS + 1` entries, because the engage is added at the front without the cap check.

## Why ENGAGE_END is larger than ENGAGE_START

Say a target escapes. It is just past the end distance, so the engage ends. If the end distance were the same as the start distance, the target would qualify again on the next tick. The unit would engage, end, engage, end. With `ENGAGE_END` larger, a target that has left stays out until the unit is near it again.

## Why the anchor is a point

The anchor is the unit's position at engage start, not the route. The distance from a point to a path is costly and hard to keep deterministic. The point is a plain integer pair.

## Invariants

- `engage` reads the world and the grid, not `Unit.target`. The weapon result does not steer orders.
- The anchor, `hold` and `skip` are order data. They are hashed (`sim/hash.md`).
- A new unqueued order, or a stop, removes an engage with the rest of the queue (`sim/orders.md`).
- The client draws an engage as an attack line to its target (`client/game/order-lines.md`).
- A guard does not start engages. Guards only fire (`sim/systems/guard.md`).
