Source: apps/client/src/ui/dom.ts, apps/client/src/ui/domStyle.ts

# DOM helpers

Small functions that every `ui/` class uses.

## dom.ts

- `byId<T>(id)`: `document.getElementById`. Throws `missing #id` if absent. Call it in constructors, so a bad id fails at startup.
- `setText(el, text)`: writes `textContent` only if it differs.
- `setHidden(el, hidden)`: writes `el.hidden` only if it differs.
- `setDisabled(button, disabled)`: same for `disabled`.
- `setSrc(img, url)`: writes the `src` attribute only if it differs. An empty `url` removes it.

## domStyle.ts

- `setClass(el, className)`: writes `className` only if it differs.
- `setWidthPct(el, pct)`: writes `style.width` only if it differs.

## Why "write only on change"

The HUD refreshes at 5 Hz, and some panels are called every frame. Writing the same value to the DOM can still cost layout work. Compare first.

## Rules

- Use these in `ui/`. Do not set `textContent`, `hidden` or `src` directly in a refresh path.
- Build elements once in a constructor. `update` only changes them. The exception is the leaderboard, which rebuilds its list when the rows change.
- The CSS `[hidden]` rule in `index.html` uses `display: none !important`, so `hidden` works on flex elements.
