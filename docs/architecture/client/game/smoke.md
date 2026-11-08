Source: apps/client/src/game/smoke.ts, apps/client/src/game/decalStamps.ts, apps/client/src/render/smokePass.ts

# Smoke state

`SmokeField` holds smoke clouds and queues scorch stamps for the ground. It is client-only and uses `Math.random`.

## Interface

```
field.update(world, timeSeconds)   // once per frame
field.items[0..count)              // live Puff records
field.stamps                       // DecalStamps queue, drained by the decal map
```

`Renderer.prepare` owns one `SmokeField` and calls `update` each frame (`client/render/pass-order.md`).

## Behaviour

- Time step `dt` comes from the `time` argument, capped at 0.1 s.
- A new `world` object resets the field: no puffs, no queued stamps.
- When `world.tick` changes, `onTick`:
  - Its own `ShotTracker` reports vanished shells. Each one calls `impact`.
  - Each ballistic shell in flight (the source kind's `weapon`) leaves one thin puff at its position (a trail).
- `impact`: `2 + splash/45` puffs (at most 7) around the landing point, rising and growing. If the shell landed within half a splash radius of the ground, it also queues one stamp: `{ x, y, radius: splash · 0.9, seed }`. Splash is at least 30.
- `advance(dt)`: moves puffs, applies drag, removes expired ones by swap.
- At most `MAX_PUFFS` = 6000 live records.

## Puff

Position, velocity, `age`, `life`, `size`, `grow`, `shade` (grey), `seed` (random, picks noise).

## Stamps

`DecalStamps` is a plain queue. `drain(sight, visit)` empties it and calls `visit` for each stamp where `sight.sees(x, y)` is true. The decal map drains it in the same frame as the impact, so the vision test is the vision at impact time. See `client/render/decal-map.md`.

## Render side

`SmokePass.fill(field, vision)` writes the seen puffs into one instance batch. `drawPuffs` runs in the translucent state. See `client/render/smoke-pass.md`.

## Recipe: add a smoke source

Spawn through `SmokeField.spawn` from `onTick` or `impact`. Respect `MAX_PUFFS`; `spawn` returns null when full.
