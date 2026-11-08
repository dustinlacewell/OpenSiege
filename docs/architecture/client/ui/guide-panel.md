Source: apps/client/src/ui/guidePanel.ts

# Guide panel

The tutorial prompt. It sits in `#guide`, under the top bar, centred.

## GuidePanel

`new GuidePanel(onContinue)`. `Hud` builds it with `() => actions.acknowledge()` (`client/input/actions.md`) and calls `update` from `refresh` (`client/ui/hud.md`).

`update(line)` takes `HudModel.guide` (`client/ui/model.md`): `{ prompt, index, count, note }`, or null.

- Null: the panel is hidden. A normal match always passes null.
- Otherwise it shows the prompt in `#guide-prompt` and "Step i of n" in `#guide-step`. `i` is `index + 1`.
- `note`: the Continue button `#guide-continue` shows. A click calls `onContinue`. Enter does the same through the `continue` hotkey (`client/input/keys-and-pan.md`).
- It writes through `setText` and `setHidden`, so an unchanged line costs nothing.

## Markup

`#guide` has class `hud`. It has a fixed size: 420 by 72 px. The prompt wraps inside it. `#guide-foot` holds the step line and the button in one row. Only the button takes pointer events. Styles are in `client/ui/markup.md`.

## Rules

- The panel knows no lesson. It shows the line the model gives it.
- The prompt must fit two lines at 420 px. Longer text is cut.
