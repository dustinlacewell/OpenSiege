Source: apps/client/src/game/lockstep.ts, apps/client/src/game/interp.ts, apps/client/src/match/handler.ts

# Lockstep (client)

`Lockstep` owns the client copy of the `World`. It steps the world once per turn from the match host, paced by a playout clock (`client/game/playout.md`), and saves poses for interpolation. It holds the turn queue and the clock state. The timing maths is in `playout.ts`.

## Interface

```
new Lockstep(sim, deps, now)   // sim: SimState = { world, nav }
ls.world                 // the live World (mutated by step); sim.world
ls.prev                  // Map<unitId, PrevPose & {gen}>
ls.prevShots             // Map<shellId, PrevShot & {gen}>
ls.expected              // the tick the next turn must carry
ls.receive(turn, now): boolean
ls.update(now): number   // turns stepped
ls.alpha(now): number    // 0..1
ls.queued                // turns waiting
```

`LockstepDeps` = `{ step, hash, onHash }`. `ClientLink` passes the sim's `step`, `hashWorld`, and a function that calls `host.checkpoint`. Tests can pass fakes.

## Constructor

`lastQueued = sim.world.tick`. The clock starts with `startPlayout(sim.world.tick, now)`. `match/handler.ts` builds `sim` with `createSimState(decodeWorld(world))`, so the nav data is derived on the client, not sent (`sim/nav/nav-grid.md`).

## receive(turn, now)

Accepts only `turn.tick === expected` (`lastQueued + 1`). On accept it queues the turn, calls `noteArrival` with `now`, and returns true.

Any other tick, a gap or a duplicate, returns false and changes nothing. The client cannot recover from it: every later turn would be refused too. `match/handler.ts` treats false as a desync. It logs `turn out of sequence: expected E, got G` with `console.warn`, then calls `session.stop()` and `restart()`, the same path as a `desync` message (`net/desync-check.md`).

## update(now)

1. `advance` the clock to `now`, with `lastQueued` as the last received turn.
2. `due = dueTick(clock)`.
3. Step every queued turn with `tick <= due`, in order.
4. Return how many it stepped.

A late turn is stepped as soon as it arrives and is due. Several turns can step in one frame when the clock has to catch up.

## stepOne

1. `recordPrev`: copy each unit's `x, y, facing, aim, elevation` and each shell's `x, y, z` into the maps. Entries not seen this pass are deleted (`gen` mark).
2. `deps.step(sim, turn.intents)`.
3. `seedLaunched`: each shell with no `prevShots` entry was launched in this step. Its entry is `launchPoint(shell)` (`client/game/interpolation.md`).
4. If `turn.tick % HASH_EVERY === 0`, `deps.onHash(turn.tick, deps.hash(world))`.

## alpha(now)

`progress(advance(clock, now, lastQueued), world.tick)`. It does not store the advanced clock. The view draws between the saved pose and the current state by `alpha`.

## Invariants

- Only `stepOne` mutates the world.
- `prev` holds state from before the last step, so it is one step old when `alpha` is 0 and the current state when `alpha` is 1.
- A unit with no `prev` entry (new this step) is drawn at its current state.
- `Effects` also reads `prev`: a muzzle flash sits at the barrel tip of the pose before the step, where the shell left (`client/game/effects.md`).
- A shell launched in a step is drawn from its launch point. A shell already in the world when the `Lockstep` is built has no entry until the first step, so it is drawn where it is. It is never backdated.
- A new `Lockstep` means a new world object. Effects, smoke and the terrain mesh detect a new world by identity (`world !== this.world`, `source === terrain`).
