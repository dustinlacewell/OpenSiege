Source: packages/sim/src/types.ts, packages/sim/src/math.ts, packages/sim/src/trig.ts, packages/sim/src/rng.ts, packages/sim/src/step.ts, packages/sim/src/hash.ts

# Determinism rules

Every peer runs `step()` on its own copy of the world. The copies must stay equal. Break one rule below and the hash check reports a desync (`net/desync-check.md`).

## Rules

- All numbers in `World` are integers. Positions, hp, timers, credits, angles, projectile fixed point.
- Every division is wrapped in `Math.floor` or `Math.trunc` before the result is stored.
- Square roots use `isqrt` (`math.ts`). It is exact. `Math.sqrt` is only its first guess.
- The sim does not call `Math.random`, `Date`, `performance.now`, `Math.sin`, `Math.cos` or `Math.pow`. Trig is platform dependent. Angles are integer steps (`sim/coordinates.md`). For sine and cosine, use the literal table in `trig.ts`.
- Random numbers come only from `rng.ts`: `nextU32(world)` and `randInt(world, lo, hi)`. The state is `world.rng` (mulberry32, uint32).
- The order of rng calls is part of the state. Add or remove one call and every later number changes.
- `world.units`, `world.players` and `world.projectiles` are sorted by id. Iterate them in array order only.
- New ids come from `world.nextId++`. This covers units, shells, fields, move groups and build jobs. Ids only grow, so a `push` keeps the array sorted.
- Do not iterate a `Map` or `Set` in sim code where the order can change the result.
- The sim has no I/O. It reads `World` and `Stamped[]` and writes `World`.
- `World` is plain data. It must survive `JSON.stringify` and `JSON.parse` (`codec.ts`). No classes, no `Map`, no `undefined` fields. Use `null` for "none" (`Unit.rally`).
- Input from outside the sim is coerced with `toInt` and checked. Bad references are dropped. The sim never throws on bad input.

## Every state field must be hashed

`hash.ts` visits each field by hand. If you add a field to `Unit`, `Player`, `Projectile`, `ResourceField` or `World`, add it to the matching `hash*` function. A field that is not hashed can drift without a desync report. See `sim/hash.md`.

## What the client may do with sim code

The client imports sim helpers that only read: `heightAt`, `effectiveRange`, `angleDelta`, `UNIT_STATS`. It may pass float coordinates to `heightAt`. It must not write to `World`. Only `step()` writes.

## In-place mutation

`step()` mutates the world for speed. A caller that needs the old values copies them first. `game/lockstep.ts` does this for poses (`client/game/lockstep.md`).
