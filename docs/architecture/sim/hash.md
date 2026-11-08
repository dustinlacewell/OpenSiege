Source: packages/sim/src/hash.ts, packages/sim/src/codec.ts, packages/protocol/src/index.ts

# World hash

`hashWorld(world)` returns a uint32. Equal worlds give equal hashes on every machine. The client reports it to its host every `HASH_EVERY` (50) ticks, and a host that holds a reference world compares it, to find desyncs (`net/desync-check.md`).

## Method

FNV-1a over bytes, with the accumulator `h` as uint32 (`Math.imul`, `>>> 0`).

- `int(n)`: low 32 bits as 4 bytes. If the value is beyond 32 bits, the high part follows.
- `str(s)`: length, then each char code.
- `bool(b)`: one byte.

## Order

`tick`, `rng`, `nextId`, then each list as `length` followed by its items in array order: players, units, fields, features, projectiles. Then the terrain.

- Per feature: id, kind, x, y, radius, hp, variant.

- Per unit: id, owner, kind, x, y, facing, hp, mode, modeTimer, orders, cooldown, queue (length, then id, kind and progress per job), lastFired, target, aim, elevation, work, arrived, rally (flag, then x and y), quota (one count per kind in `UNIT_KINDS` order, 0 when missing).
- Orders: the length of `Unit.orders`, then each entry in queue order. An entry is its `type` string, then `move`: x, y, group, attack, skip, the number of waypoints and each one's x, y, then best, stall; `attack`: target, hold; `engage`: target, hold, x, y; `guard`: target, chase; `siege`: `on`. The last branch of `hashOrder` is the `siege` case, so a new order type needs its own branch.
- Terrain: `cols`, `rows`, `cell`, the number of heights, then every height.

## Invariants

- Every field of every state type must be hashed. A field that is not hashed can differ without a report.
- Changing the hashed order changes every hash. Every peer must run the same version.
- The hash does not read anything outside `World`.

## Cost

It walks the whole world. It runs once per 50 ticks on each side. Do not call it per frame.

## Codec

`codec.ts` is `JSON.stringify` and `JSON.parse` of `World`. So every plain field, `Unit.quota` included, reaches the welcome snapshot with no codec change. The host sends it in `welcome` (`net/match-messages.md`). `match/handler.ts` decodes it. The decoded world is a fresh object. `Lockstep` and the renderer use object identity to notice a new world.
