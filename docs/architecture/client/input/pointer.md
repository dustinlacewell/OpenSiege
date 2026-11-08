Source: apps/client/src/input/pointer.ts, apps/client/src/input/dragBox.ts

# Pointer input

`Pointer` listens to mouse events on the canvas. It calls `Actions` and changes the camera.

## Mapping

| Gesture | Result |
|---|---|
| Left click | `clickSelect`. Shift adds. |
| Left double-click (350 ms, 6 px) | `kindSelect(x, y, shift, global = false)`: the clicked kind on screen. Shift adds. |
| Ctrl + left double-click | `kindSelect(x, y, shift, global = true)`: the clicked kind on the whole map. Shift adds. |
| Left drag (more than 5 px) | rubber band, then `boxSelect` on release |
| Right click | On release: `command(x0, y0, { force: Alt, queue: Shift }, rally = Ctrl)` at the press point. Shift queues the order. Alt forces a move on a sieged unit. Ctrl sets the rally point. |
| Right drag (more than 5 px) | curve move: `curveTo` on each move, then `curveTo` and `commandCurve({ force: Alt, queue: Shift })` on release |
| Right drag from scrap, engineer selected | area reclaim: `areaTo` on each move, then `areaTo` and `commandArea({ force: Alt, queue: Shift })` on release. No curve. |
| Ctrl + right drag | a rally click at the press point. No curve. |
| Middle drag | pan the camera |
| Ctrl + middle drag | orbit: horizontal turns yaw, vertical changes tilt |
| Wheel | zoom toward the cursor |
| Ctrl + wheel | tilt |

## Target mode

While `actions.targetMode()` is not null (guard or attack-move, `client/input/actions.md`):

- Left press and release: `targetAt(x0, y0, { force: Alt, queue: Shift })` at the press point. No box, no selection change, no double click.
- Right press: `cancel()`. Nothing else happens on its release.
- Middle drag and the wheel work as usual.
- `showTargetCursor(on)` sets the canvas cursor to `crosshair`. `Input.update` calls it each frame. It writes the style only on a change.

## Details

- Events: `pointerdown` on the canvas. `pointermove` and `pointerup` on `window`, so a drag can leave the canvas. Pointer capture is set on drag start.
- `contextmenu` is prevented.
- `position` is the last pointer position in CSS pixels, or `null` when the pointer leaves the window. `Input.update` reads it for edge panning.
- A drag becomes a box select only after the pointer moves more than `DRAG_PX` (5) from the start.
- The right button fires on `pointerup`, not `pointerdown`, so a click and a drag can be told apart. Shift and Alt are read on release. Ctrl is read on press.
- When a right drag passes `DRAG_PX`, `Pointer` calls `areaStart(x0, y0)` once. True makes the drag an area reclaim (`Drag.area`). False makes it a curve move.
- The first `curveTo` of a right drag is the press point, so the curve starts where the drag did.
- Esc and window `blur` call `cancelDrag()`. A right drag keeps `dragCancels()` from its press. When the count changes, `Pointer` drops the drag, so its moves and release do nothing. The next press starts a new drag.
- A click that follows another within `DOUBLE_MS` and `DOUBLE_PX` is a double click. The pair is consumed.
- Wheel zoom factor: `1.0015 ^ -delta`. Line-mode wheels are scaled by 30.
- Orbit: `ORBIT_PER_PX` = 0.005 rad per pixel. Ctrl+wheel tilt: `TILT_PER_WHEEL` = 0.0015 rad per wheel pixel.
- Coordinates are made local to the canvas rectangle.

## DragBox

`DragBox` (`dragBox.ts`) shows and hides the `#dragbox` element as a rectangle. It only sets inline style.

## Invariants

- `Pointer` keeps no game state. It holds the drag and last click only.
- Keyboard state is in `Keys`, not here.

## Recipe: add a mouse gesture

Add it in `down`, `move`, `up` or `wheel`. Put the meaning in a new `Actions` method. Do not call the sim or build intents here.
