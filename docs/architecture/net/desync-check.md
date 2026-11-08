Source: apps/client/src/game/lockstep.ts, apps/client/src/match/handler.ts, apps/client/src/app/matchHost.ts, apps/client/src/app/clientLink.ts, packages/sim/src/hash.ts, packages/protocol/src/index.ts

# Hash check and desync

The client proves its world matches a reference by sending a hash. A host that holds a reference world compares it.

## Client

- `Lockstep.stepOne` calls `deps.onHash(tick, hash)` after stepping a turn with `turn.tick % HASH_EVERY === 0`. The hash is `hashWorld` of the world after that step.
- `ClientLink` binds `onHash` to `host.checkpoint?.(tick, hash)`. A host that has no reference does not define `checkpoint`. `LocalHost` does not.
- On `desync`, `handleMatch` calls `session.stop()` and `deps.restart()`. `restart` is `host.desync()`.
- A turn out of sequence takes the same path. `Lockstep.receive` returns false. `handleMatch` logs `turn out of sequence: expected E, got G` and stops the session.
- `LocalHost.desync()` leaves the match and goes home.

## Reference host

A host that wants the check does these steps:

- After its own `step()`, if `world.tick % HASH_EVERY === 0`, it records `hashWorld(world)` by tick.
- On `checkpoint(tick, hash)` it looks up `tick`. If unknown, it does nothing. If equal, it does nothing. If different, it delivers `{t:"desync", tick}` to that client only.
- It must hash after the same step as the client. Then the two match.

## What the hash covers

Everything in `World` that the sim reads (`sim/hash.md`). It does not cover client-only state: particles, smoke, camera, selection.

## Debugging a desync

- A desync means a client's sim diverged. Look for: a non-integer value, `Math.random` or a clock in sim code, iteration over an unordered collection, an unhashed field that differs, or two sim versions.
- The hash says only that the worlds differ. It does not say where. To find the field, hash parts of the world separately in a throwaway script.
