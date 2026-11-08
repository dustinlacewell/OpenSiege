Source: apps/client/src/ui/startScreen.ts, apps/client/src/main.ts, apps/client/index.html

# Start screen

`#start`, the first screen. It sits over the backdrop (`client/app/backdrop.md`) with a vignette. No game HUD shows. `main.ts` builds it after `startClient`.

Layout, centred: the masthead (the title "OpenSiege"), then the skirmish setup card (`client/ui/skirmish/setup-card.md`). In dev builds (`import.meta.env.DEV`) a dev strip sits fixed at the bottom left: small muted links.

## StartScreen

```
new StartScreen(root, deps: StartDeps, handlers: StartHandlers)
start.show()
start.hide()
```

- `StartDeps`: `draws` (the maps to choose from, `client/game/skirmish/map-library.md`) and `nameSlot` (where the player's name is kept, a `StorageSlot`; `main.ts` uses `localStorageSlot("mobilefront.name")`).
- `StartHandlers` extends `SkirmishHandlers` (`onPlay(setup)`, `onTutorial()`) with `onSandbox()`.
- The constructor replaces the children of `root` with the masthead, the `SkirmishView` root and, in dev builds, the dev strip.
- `show()` and `hide()` set `hidden` on `root`.

## Dev strip

A `nav` labelled "Dev tools": the text "dev", a "sandbox" button (`onSandbox`) and links that open in a new tab: `/units.html` (unit stats), `/map-editor.html` and `/sounds.html`. The strip is absent in production builds.

## Flow

`main.ts` runs `host.skirmish`, `host.tutorial` or `host.sandbox` from the handlers. If the host became active, `main.ts` hides the start screen. The host's `onHome` shows it again (`client/app/start.md`).
