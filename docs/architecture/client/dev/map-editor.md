Source: apps/client/map-editor.html, apps/client/src/dev/mapEditor/, apps/client/devMapsPlugin.ts, .wm/commands/map-editor.ts

# Map editor

A dev-only page at `/map-editor.html`. It edits an `EditorMap` from `@mf/map` (a name, a base height, a sim `MapSpec`, a material layer and a palette). Maps live as `.json` files in the repo's `maps/` folder. Start it with `wm map-editor`; it runs the Vite dev client. Like the unit editor, the page is not in the production build, and `main.ts` throws unless `import.meta.env.DEV`.

## Layout

- Level list: the page opens on it. A grid of cards, one per map in `maps/`: its top-down preview, name and size. It has New. Maps in the toolbar shows it again, with Back to return to the open map.
- Toolbar: Maps, Properties, Save, the map's name, file, size, cell and base height, Undo, Redo. A status line under it shows save results.
- Left panel: tool buttons, the four material swatches, and the brush sliders.
- Viewport: the rest of the page.

## Maps folder

`devMapsPlugin.ts` serves `/__dev/maps` on the dev server. GET `/` lists the maps (`MapEntry`). GET `/<file>` returns one. PUT `/<file>` checks the body with `parseMap` and writes it atomically, so a bad map never reaches the disk. File names are `[a-z0-9-]+.json`.

- New opens the properties form with name "New map", 16000 by 16000, cell 125, base height 300. The file name comes from the name (`fileNameFor`), unique in the folder. The map is not on disk until Save.
- Opening a map or making a new one asks first if the open map has unsaved edits.
- Save writes to the map's file. A rename changes the name in the file, not the file name.
- Preview: `<stem>.jpg` beside the map, 512 px on the long side. `previewShot.ts` draws the map straight down from above, north up, and crops the map's rectangle. The loop draws the shot before its own frame in the same task, so it is never on screen. `PreviewSchedule` takes one 30 s after a change, at once on open and on Save. Only a map that has a file gets one.
- A brush whose centre is off the map still edits the part that is on it (`symmetricPoints` keeps copies within the brush radius of the map).

## Properties

The form edits name, width, height, cell and base height, checked by `propsErrors`. The cell is fixed after the map is made.

- The same size: only the name and base height change.
- A new size runs `resizeMap`. The corner (0, 0) stays put. Shrinking cuts heights, paint, features (by centre) and zones (unless wholly inside). Growing adds flat ground at the base height, painted with material 1. The editor reloads the map, so undo is cleared and the camera reframes.

## Tools

| Tool | Package tool |
|---|---|
| Raise, Lower, Smooth, Flatten, Noise | `height`. Strength 0..1 is 0..40 height units per dab. Flatten aims at the height under the stroke's start. |
| Paint 1 to 4 | `material` on that channel. The colour input next to a swatch edits the palette entry live. Palette edits are not undoable. |
| Tree, Rock, Boulder with Place, Scatter, Erase | `feature`. Erase removes only the chosen kind. Scatter uses Density. |
| Place zone, Erase zones | `field`. Place uses Zone radius and Zone amount. Erase uses the brush radius. |

Place tools act once per stroke, at the press point. Other tools dab along the drag, at least 15% of the radius apart. Each dab gets its own seed from the stroke's random seed.

## Input

- Left drag: a stroke. Each pointer move picks the ground point (`groundAt`) and calls `symmetricDab`. Release calls `commitStroke` once, so one stroke is one undo step per edit kind.
- Symmetry: 1 to 8 copies rotated about the map centre; Mirror reflects each copy too (`packages/map/src/symmetry.ts`). Brushes dab again at each copy point. Place and scatter add their features or zones once, then add exact transformed copies. Copies that fall off the map are dropped, so on a non-square map only 1 or 2 copies cover it whole. The noise brush hashes cells, so its copies match in strength, not in grain.
- The cursor (`cursorRings.ts`), one set per copy: the brush edge and a 3-pixel centre mark, and for height and paint tools four inner rings whose brightness is strength times falloff weight at that radius. Scatter adds a hex grid of dots at the density's spacing (skipped past 600 dots). The OS pointer is hidden over the canvas: the centre mark is the pointer, since the drawn ring is always a frame behind the OS one. The editor's GL context asks for `desynchronized` (low latency) to cut that lag. The edge is the zone radius while placing a zone, else the brush radius.
- Place, scatter and erase tools outline what a press would do (`previewDab`): white circles for features or zones it would add, red for those it would erase. The preview uses the seed the next dab will use, so a scatter lands exactly where its outlines were.
- Camera: the game's camera and gestures. Middle-drag pans, Ctrl+middle-drag orbits and tilts, the wheel zooms toward the cursor, Shift+wheel tilts. Arrows and WASD pan. Input moves a target camera; the shown camera eases toward it at rate 28 per second (`cameraEase.ts`). Picking uses the shown camera.
- Ctrl+wheel scales the brush radius, about 4% a notch. The wheel with the right button held changes the strength, about 0.02 a notch. F+wheel changes the falloff (about 0.02), C+wheel the density (about 10%). A key the wheel used stops panning until it is released. None of these round, so small touchpad steps add up; the panel shows them rounded.
- The top right of the viewport shows frames per second and the slowest frame of the last half second.
- Keys: `[` and `]` scale the radius by 1.15. `1` to `4` pick the material while a paint tool is on. Ctrl+Z undoes; Ctrl+Y or Ctrl+Shift+Z redoes. Keys are ignored while a form control has focus; a press on the canvas drops that focus.

## Rendering

`Viewport` composes the game's passes for a map with no players: sky, terrain, ground cover (`ScatterPass`), features, the brush ring, then `hdr.grab()` and the water, and the sun's shadow map, then tone mapping. It has no point lights, never stamps the decal map, and has no ripple field, so the water is calm. The brush ring is a `LineBatch` ring. It draws before the grab, so a ring on ground under water shows through the water.

`MapScene` holds a throwaway `World` from `createWorld`. Its terrain shares the spec's `heights` array, so `heightAt` and picking see an edit at once. Its `seaLevel` is `seaLevelOf(heights)`.

What a dab refreshes:

- Height: grows a dirty rectangle of sim vertices. `Editor.flush`, once per frame, sets `terrain.seaLevel = seaLevelOf(terrain.heights)`, so the water follows the edit. Then it calls `Viewport.updateMesh` with the rectangle. That calls `TerrainPass.updateMesh`, which rewrites and uploads only the mesh rows that read those vertices, and `WaterPass.refresh`, which uploads that rectangle of the ground height map. At the stroke's end, and on undo or redo of heights, the scene gets a new terrain object on the same array. That rebuilds the mesh, the features' ground heights and the ground cover.
- Material: `uploadRect` with the dab's `editBounds`. The whole layer uploads only on a new map.
- Features and fields: the scene rebuilds its world from the spec on the same terrain. The feature passes see the count change.

## Files in the folder

- `main.ts`: the orchestrator. It connects the views, keys, camera framing and the loop.
- `editor.ts`: the session, the settings, the stroke, and what each edit refreshes.
- `settings.ts`: pure. The panel state and the package `Tool` it stands for.
- `stroke.ts`: one stroke's tool, seed, edits and dab spacing.
- `mapScene.ts`: the world the passes read.
- `viewport.ts`: the render passes.
- `brushInput.ts`, `cameraInput.ts`, `keys.ts`: input.
- `toolbarView.ts`, `toolPanelView.ts`, `levelSelectView.ts`, `propertiesView.ts`: the DOM views.
- `mapLibrary.ts`: the maps folder routes, and `fileNameFor`.
- `previewShot.ts`, `previewSchedule.ts`: the top-down preview and when to take it.

## Limits

- There is no nav connectivity check, no field drag-resize, and no spawn hints.
