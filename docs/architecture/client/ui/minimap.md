Source: apps/client/src/ui/minimap.ts, apps/client/src/ui/minimapModel.ts, apps/client/src/ui/heightImage.ts

# Minimap

A 2D canvas overview in the left console box (`#minimap`). The longer canvas side comes from the canvas `width` and `height` attributes at start (200 pixels). When a terrain arrives, the canvas takes the map's aspect (`minimapExtent`): the longer map side gets that length, the other side is scaled by the map's width to height ratio and rounded.

## Drawing (`Minimap.draw(world, cam)`)

Called by `Hud` every 100 ms. With no world it fills the background only.

1. Background fill.
2. Terrain image, `heightImage(terrain, w, h)`. Cached. It is rebuilt, and the canvas reshaped, when the `Terrain` object changes. Never fogged.
3. Fields as translucent teal discs (radius at least 1.5 px). Always drawn.
4. Units as small squares in the owner's colour: 4 px for factories, 2 px for others. Grey if the owner is not found. Only units the vision shows (`client/game/vision.md`).
5. Radar contacts as round dots of radius 2.5 px in the owner's colour, at alpha 0.55, at `vision.radarSpot`. The same rough place as the dot in the world.
6. The camera footprint: the four screen corners picked onto the ground with `groundAt`, drawn as a white polygon.

World to minimap: `pixel = world · k`, where `k = canvas width / map width` (`minimapScale`, same on both axes). `+x` goes right and `+y` goes down. The minimap does not turn with the camera yaw.

`Minimap` takes the `Vision` as its third constructor argument. `Hud` passes the one from `startClient`.

## heightImage

`heightImage(terrain, w, h)` makes a canvas of that size. Each pixel: colour from low to high by height, shaded by the slope along the `(+x, +y)` diagonal, so light comes from the north-west.

## Input

Pointer down, and pointer move with the left button held, call `actions.jumpTo(worldX, worldY)`. The point is the click fraction of the canvas box times the map width and height (`minimapWorld`). It centres the camera there (`client/input/actions.md`).

## Invariants

- It reads `World` directly, not `HudModel`. It runs at 10 Hz.
- It reads sim positions, not interpolated poses.
- `drawFootprint` ignores the return value of `groundAt`. If a corner ray misses the ground, that polygon point reuses the scratch vector from the previous corner.

## Recipe: add a minimap layer

Add a method like `drawWorld` and call it from `draw`, between the image and the footprint.
