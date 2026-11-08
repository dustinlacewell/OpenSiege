Not built. Proposal.

# Blasts

A blast is one explosion. It damages units, features and the ground. Shells and dying units make blasts. One function applies every blast.

## Shape

`Blast` is `{ x, y, z, damage, radius, dig }`. All fixed point, like a projectile (`sim/coordinates.md`).

- A blast has no owner. It hurts every unit in its radius, the shooter's own and allies included.

## detonate(state, grid, blast, struckUnit, struckFeature, near)

Pure on `SimState`, in a new `blast.ts`. It replaces the body of `impact.ts`. `grid` is the unit grid `projectiles` gets; splash queries it, so a blast checks only nearby units.

1. Units: `struck` takes full damage. Every other unit within `radius` takes the linear falloff. Owner rule above.
2. Features: the same falloff (`splashFeatures`).
3. Ground: `stampCrater` (`craters.md`). It adds the changed box to the tick's dirty list (`nav-update.md`).

A shell impact builds a `Blast` from the shell and calls `detonate`.

## Death blasts

- `UnitStats` gets `deathDamage` and `deathRadius`. 0 = no blast. Fields go in `statFields.ts`, so the unit editor shows them.
- `deaths` pushes one `Blast` per dead unit with a blast, in unit order, into `world.blasts`. Then it removes the units.
- The next tick, `projectiles` detonates `world.blasts` in list order, before it moves shells. Then it clears the list.
- A death blast that kills a unit queues that unit's blast for the tick after. A chain spreads one tick per step. There is no recursion inside a tick.

`world.blasts` is sim state. It is in `hashWorld` and in the snapshot. A late joiner gets the pending blasts.

## Client

The client draws a death explosion for each entry in `world.blasts` on the tick it appears. Today a dying unit just vanishes. Shell explosions stay as they are (`ShotTracker`).

## Tests

- A death blast hurts units of both teams. A shell blast does not hurt its owner.
- Three units in a row, each in the next one's radius: they die on three ticks in a row.
- The same chain run twice gives the same hash.
