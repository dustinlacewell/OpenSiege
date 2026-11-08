Source: apps/client/src/main.ts, apps/client/src/app/start.ts, apps/client/src/app/frameLoop.ts, apps/client/src/game/lockstep.ts, apps/client/src/match/handler.ts, apps/client/src/ui/portraits.ts, apps/client/src/render/renderer.ts

# Client layers and file ownership

The client is seven folders under `apps/client/src`. Each owns one kind of thing. The import arrows below are what the code does now.

## Folders

| Folder | Owns | May import |
|---|---|---|
| `game/` | Client game logic: lockstep, session, camera, picking, poses, commands, effect state, the skirmish rules. No DOM. No GL. | `@mf/sim`, `@mf/ai`, `@mf/map`, itself |
| `render/` | Everything WebGL2: passes, shaders, meshes, buffers. | `game/`, `@mf/sim` |
| `ui/` | The DOM HUD, the 2D minimap canvas and the start screen. | `game/`, `input/actions` (type only), `@mf/sim` |
| `input/` | Mouse and keyboard events. Turns them into `Actions`. | `game/`, `@mf/sim` |
| `match/` | Match messages in, the `Session` and the screens out. The offline match clock. | `game/`, `@mf/protocol`, `@mf/sim` |
| `audio/` | Web Audio: sound events from world changes, the mixer, synth voices, rendered weapon samples, interface sounds (`client/audio/`). | `game/`, `input/actions` (type only), `@mf/sim` |
| `app/` | `startClient`, the host seam, the per-frame loop and the page shell. | all of the above |

`app/start.ts` is the composition root. It builds every object and connects them. `main.ts` is the page entry: it builds a `LocalHost` and the start screen and calls `startClient(host)`.

## Rules

- `game/` imports nothing from `render/`, `ui/`, `input/`, `match/` or `app/`. It never touches `document`, `window` or GL.
- `render/` never imports `ui/`, `input/`, `match/` or `app/`. It reads game state through one `Frame` object (`client/render/frame.md`).
- `ui/` never imports `render/`.
- A view does not reach past `game/` into the sim to change state. Nothing on the client writes `World` except `step()` inside `Lockstep`.
- Intents leave through `Actions` and `host.intent`. Views call `Actions`; they do not build messages.
- The client reaches its match only through the `MatchHost` seam (`client/app/match-host.md`).

## What `game/` is, and is not

`game/` is free of DOM and GL. It is not free of state. These are mutable, client-only, and never feed the sim:

- `Camera`, `Session` selection, `Lockstep` pose maps.
- `ParticlePool`, `SmokeField`, `Effects`. They use `Math.random` and wall-clock `dt`.
- `Vision`, the fog of war: what the local player knows of each unit.

The pure parts (camera math, picking, `fillPoses`, `commands.ts`, `selection.ts`, `lookup.ts`, `hotkeys.ts`, `buildGrid.ts`, `skirmish/`) take plain data and return plain data.

## Known seam crossings

- `render/renderer.ts` owns and advances a `SmokeField` (`game/smoke.ts`). `app/frameLoop.ts` owns `Effects`. Both are effect state.
- `app/frameLoop.ts` and `ui/` import `goHome` and the `Actions` type from `input/actions.ts`.
- `ui/` shows images that `render/` draws. The seam is the `Portraits` interface in `ui/portraits.ts`; `start.ts` passes `renderer.portraits` to `Hud`.
- `game/skirmish/world.ts` imports the `LocalBot` type from `match/localMatch.ts`.

## Where to put new code

- A rule about what a click or key means: `game/commands.ts` or `game/hotkeys.ts`.
- A DOM listener: `input/`.
- A panel or readout: `ui/`, with its data shaped in `ui/model.ts`.
- A draw call: `render/`.
- Anything that two of those need and that has no DOM or GL: `game/`.
