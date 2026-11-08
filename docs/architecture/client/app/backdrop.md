Source: apps/client/src/app/backdrop.ts, apps/client/src/game/backdropOrbit.ts

# Backdrop

The scene behind the start screen and any home screen a page adds. It is real terrain, drawn by the normal `Renderer`.

## Backdrop

`new Backdrop()`, built once in `startLoop`.

- The world is `createWorld(generateMap(SEED, DEFAULT_MAP_PARAMS))` with a fixed seed and the default map parameters. Both are pure and deterministic (`sim/map-spec.md`), so the world needs no match. It has terrain and resource fields. It has no players and no units, so the crystals show and nothing else moves.
- The constructor takes `mapSize(world.terrain)` and calls `setCameraMap` on the backdrop camera.
- It owns its own `Camera`, `Vision` and `ParticlePool`. Input holds the game camera only, so no input reaches the backdrop camera.
- `frame` is a full `Frame` (`client/render/frame.md`) made once: the world, empty maps and sets, `me` -1.
- `update(now, dt, dpr, size)`: resize the camera to `size` if needed, put it on the orbit at `now / 1000` seconds, set the lowest pitch plus `LIFT` (0.05 rad), `followGround`, then set `dpr` and `time`.

## orbitAt(t, map) (pure)

`map` is a `MapSize`. Gives `{ x, y, dist, yaw }`.

- The look-at point laps the map centre (`width / 2`, `height / 2`) at radius `0.22 · min(width, height)`, one lap in 420 s.
- `dist` swings 4200 ± 700 over 90 s.
- `yaw` looks toward the map centre, with a ±0.25 rad sway over 60 s.

## When it shows

The frame loop draws the backdrop whenever `session.lockstep` and `session.pickWorld` are both null: before the first match, on the start screen, and after a leave or desync. In the choose-your-start phase it draws the pick scene (`client/app/pick-scene.md`). On `welcome` the session gets a lockstep, and the next frame draws the match world with the game camera. When the host calls `link.stop()` the session stops, and the backdrop comes back. The end card shows the frozen match, not the backdrop, because the session keeps its world until the host stops it.

`TerrainPass` builds a mesh per terrain object, so each swap uploads the other terrain once.
