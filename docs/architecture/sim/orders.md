Source: packages/sim/src/orders.ts, packages/sim/src/types.ts, packages/sim/src/stats.ts, packages/sim/src/intents/, packages/sim/src/guard.ts, packages/sim/src/systems/lostTargets.ts

# Order queue

`Unit.orders` is a list of `Order`. The first entry, the head, runs now. An empty list means the unit is idle. There is no `idle` order. A unit holds at most `MAX_ORDERS` (32). The `engage` order may add one more entry (below).

Orders only say where the hull goes and why. Steering walks the hull to a goal (`sim/systems/movement.md`). Weapons fire on their own, on any order, moving or not (`sim/systems/combat.md`). Steering and weapons do not talk to each other. Only the order decides.

## Order types

- `move {x, y, group, attack, skip, path, best, stall}`: walk to the point `x, y`, the unit's own spot, around blocked ground along `path`, planned when the order is first driven (`sim/nav/pathfinding.md`). Build one with `moveOrder`. Done when the unit arrives (`sim/systems/arrival.md`). With `attack` (an attack-move) the unit always drives its route. Weapons fire on the way. The `engage` system stops it to fight (`sim/systems/engage.md`). `skip` is one enemy id that the attack-move search ignores. 0 means none.
- `attack {target, hold, x, y}`: close on the target and fire. `hold` is true while the unit stands inside the dead band. A target inside the weapon's `minRange` makes a mobile unit back off (`sim/systems/movement.md`). Done when the target is gone or dead, or when the team loses it (below). `x, y` is where the team last detected the target: set by the intent, which only takes a detected target, and refreshed by `lostTargets` while the order is the head.
- `engage {target, hold, x, y}`: a temporary order. An attack-move puts it at the front of its queue (`sim/systems/engage.md`). It acts like `attack`. `x, y` is the anchor: the unit's position when the engage started. Players do not give it.
- `siege {on}`: deploy (`on`) or pack up. Done once the unit is sieged (`on`) or mobile (off) (`sim/systems/siege-modes.md`).
- `guard {target, chase}`: stay near an own unit, fight or heal near it. Done only when the target is gone or dead. `chase` is true while the guard drives back inside its leash. The intent sets it false (`sim/systems/guard.md`).
- `reclaim {target}`: engineers only. Drive into reach of the scrap feature `target` and take its hp for credits. Done when the scrap is gone or has no hp (`sim/systems/reclaim.md`).

## Helpers (`orders.ts`)

- `head(u)`: the head order, or `undefined` when idle.
- `advance(u)`: drops the head. If the next head is a `move`, it also sets `arrived = 0`.
- `give(u, order, queue)`: with `queue`, appends. Without, replaces the whole list. An append past `MAX_ORDERS` is dropped. Always sets `arrived = 0`.
- `lastMove(u)`: the destination of the last `move` in the list, or `undefined`. `move` uses it as the start of the next leg (`sim/formation.md`).

## Who reads the head

- `modes`: starts deploy or pack for a `siege` head, or packs an anchored unit whose head is a `move`. Pops a finished `siege`.
- `lostTargets` (`systems/lostTargets.ts`): checks an `attack` or `engage` head whose target is alive against the tick's detection (`sim/detection.md`, `detectionFor`). A detected attack target writes its position to `x, y`. A lost one ends the order: an attack on a mobile or packing unit becomes `moveOrder(x, y, target, false)`, a plain move to the last detected spot, never to where the target is now. An anchored unit drops the attack instead, so `modes` does not pack it up. A lost `engage` ends, so the attack-move behind drives on. A queued attack is checked only when it comes up.
- `engage`: an attack-move head gets an `engage` put in front. An `engage` head may end itself (`sim/systems/engage.md`).
- `movement`: walks a `move` head, closes on an `attack` or `engage` head, keeps near a `guard` target, drives into reach of a `reclaim` scrap. Pops an `attack`, `engage`, `guard` or `reclaim` whose target is gone. Packs an anchored guard or reclaimer that has to move.
- `arrival`: pops a finished `move`.
- `combat`: an `attack` or `engage` head is the preferred target while detected. A `guard` head prefers the detected enemy nearest its target.
- `repair`: a `guard` head makes a mobile engineer prefer the most hurt friendly near its target. A `reclaim` head in reach takes scrap hp before any heal.
- `separation`: any entry makes a mobile unit a mover.

Only the head runs. Later entries wait. A `guard` or `reclaim` head blocks the queue until its target is gone. An `attack` head blocks it until its target is gone or lost. An `engage` head blocks it until the engage ends.

## Who writes the list

- The `move`, `attack`, `siege`, `guard` and `reclaim` intent handlers (`intents/`): through `give`.
- `engage` puts an `engage` in front of an attack-move and writes `skip` on it (`sim/systems/engage.md`). The queue may then hold `MAX_ORDERS + 1` entries. A new unqueued order replaces the whole list, an `engage` included. A stop clears it.
- `guardGoal` writes `chase` on a guard head (`sim/systems/guard.md`).
- `lostTargets` writes `x, y` on an attack head, replaces a lost attack with a move, or drops it (above).
- `stop` sets `orders = []` and `arrived = 0`. It does not touch `mode`.
- `production` gives a new unit one `move` to its factory's rally point. With no rally it gives one `guard` on the factory, except to a harvester, which gets no order.

## Invariants

- The list is hashed in full: length, then each entry (`sim/hash.md`).
- Nothing sorts or reorders the list. Order of entry is order of execution.

## Recipe: add an order type

1. Add the variant to `Order` in `types.ts`.
2. Add a branch in `hashOrder` (`hash.ts`). Its last branch is the `siege` case, so a new type needs its own. Hash every field.
3. Give it a done rule and a system that calls `advance`.
4. Add an intent that calls `give` (`sim/intents.md`).
5. Draw it in `orderChain` (`client/game/order-lines.md`).
