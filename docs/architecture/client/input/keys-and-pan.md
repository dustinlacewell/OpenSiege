Source: apps/client/src/input/keys.ts, apps/client/src/input/pan.ts, apps/client/src/input/input.ts

# Keyboard and panning

## Keys

`Keys` listens on `window`.

- `keydown`: ignored while an `<input>` or `<textarea>` has focus (the name box).
- Arrow keys are added to a `held` set and `preventDefault` is called. `isHeld(code)` reads it.
- Any key with Meta held is ignored.
- Otherwise `hotkeyFor(e.code, { ctrl, alt, shift })` (`client/game/commands.md`). If it maps, `preventDefault` and, unless it is a key repeat, call `actions.hotkey(key, shiftKey, e.timeStamp)`. Alt maps only digits. Ctrl+digit maps to nothing, so the browser keeps it.
- The map: F siege (Shift+F queues), H stop, G guard mode, R attack-move mode, Esc leaves the mode or cancels a right drag, Enter (or numpad Enter) is Continue on a tutorial note, Q W E / A S D / Z X C the build grid slots (Shift builds 5), Space home, 1 to 9 control groups (Alt saves, Shift adds), Ctrl+A select all, Period idle builders, Comma idle harvesters (Shift adds). It uses `e.code`, so the grid is the same block on any keyboard layout.
- Grid keys build only when a selected own factory exists. Without one they do nothing.
- Alt+digit maps, so `preventDefault` stops the browser's own Alt+digit action. Some browsers may still act on it before the page sees the key.
- `keyup` removes the key. `blur` clears the set.
- A bare Alt press and release is `preventDefault`ed (`suppressMenuBar`), so the force-move modifier does not focus the browser menu bar.

## panVector

`panVector(input, dt)` is pure. It returns a screen-space `[dx, dy]` for the frame.

- Arrow keys give -1, 0, +1 per axis.
- Pointer edge: within `EDGE_PX` (12) of an edge adds ±1 on that axis.
- The result is `sign(d) · PAN_SPEED · dt` per axis. `PAN_SPEED` = 900 CSS pixels per second.

## Input.update(dt)

`Input` (`input.ts`) builds a `Pointer` and a `Keys`. Each frame `update(dt)` calls `panVector` with the held arrows, the pointer position and the canvas size. If the result is not zero it calls `pan(cam, -dx, -dy)`. The sign flip makes "view moves right" the same as "world slides left".

Then it sets the target-mode cursor (`pointer.showTargetCursor(actions.targetMode() !== null)`) and calls `actions.hoverTarget(pointer.position)` (`client/input/actions.md`).

`pan` works in screen pixels and respects the camera yaw (`client/game/camera.md`).

## Invariants

- Edge pan is active whenever the pointer is within the window. It does not check for focus.
- Only arrows pan from the keyboard. Other keys fire once per press.

## Recipe: add a held key

Add the code to `ARROWS`-style handling in `Keys` and a field to `PanInput`, or create a new held-key reader and read it in `Input.update`. For a one-shot key use `hotkeys.ts` instead.
