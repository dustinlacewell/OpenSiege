Source: apps/client/src/app/pickScene.ts, apps/client/src/app/frameLoop.ts, apps/client/src/app/clientLink.ts, apps/client/src/game/session.ts, apps/client/src/input/actions/pick.ts

# Pick scene

The scene of the choose-your-start phase: the match world with terrain and no players, drawn by the normal `Renderer`.

## Session

`link.place(placement)` calls `session.startPick(placement.you, placement.world)`. That stops the session, then sets `me` and `pickWorld`. `start` (on `welcome`) and `stop` clear `pickWorld`. `pickWorld` and `lockstep` are never set together.

`session.terrain` is the ground of the lockstep world, or else of the pick world. The camera follow, the zoom anchor and the frame loop read it, so they work in both phases.

## PickScene

`new PickScene(cam)`, built once in `startLoop`. Unlike the backdrop, it uses the game camera, so pan, zoom and orbit work as in a match.

- `frame` is a full `Frame` (`client/render/frame.md`), `me` -1, with its own `Vision` and `ParticlePool`.
- `update(world, cam, now, dpr)`: when `world` is new, `begin` fills the frame and its vision, calls `setCameraMap(cam, mapSize(world.terrain))` (which puts the camera over the map centre), sets 0.8 of the farthest zoom, yaw 0, tilt 0. Then it sets `dpr` and `time`.

## Frame loop

Each frame: `ls` set draws the match; else `pickWorld` set updates the scene, draws `pickScene.frame`, then calls `drawPick` (panel and markers, `client/ui/pick.md`); else it draws the backdrop (`client/app/backdrop.md`). The match HUD is hidden and has no world to show.

## Click

`Pointer.click` first calls `actions.chooseSpot(x, y)` (`input/actions/pick.ts`). With a `pickWorld` it finds the ground point (`groundAt`) and calls the pick callback. `startClient` binds that callback to `link.pick(x, y)`, which calls `placement.onPick(x, y)`. The click is used up. Without a pick world `chooseSpot` returns false and the click selects as usual.
