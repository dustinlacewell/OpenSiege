Source: apps/client/src/app/start.ts, apps/client/src/main.ts, apps/client/index.html

# startClient

`startClient(host, options?)` is the client's one entry. It mounts the shell, builds every long-lived object, connects them, runs the frame loop and hands back `{ stop() }`. It is the composition root.

```
startClient(host: MatchHost, options: ClientOptions = {}): RunningClient
ClientOptions  { endLabel? }      // the end card's button label, default "Continue"
RunningClient  { stop() }         // stops the frame loop and drops the match
```

`start.ts` also re-exports the types `EndKind`, `MatchHost`, `MatchLink`, `Placement`, `PlacementMark`, `PlacementRow` and `PlacementView`. A page imports them from `@mf/client`.

## Build order

1. The shell markup goes in at the top of `<body>` (`client/app/shell.md`).
2. `canvas`, `SettingsStore` (key `mobilefront.settings`), `SettingsModal`, the Controls and Settings buttons.
3. `Session`, `Camera` (`createCamera`), `Vision` (`client/game/vision.md`), `GuideSlot` (`client/game/tutorial/core.md`). The slot holds `NO_GUIDE` until a guide is set.
4. `sendIntent`: calls `host.intent(session.self, intent)`, unless the session is viewing another player (`session.viewing`).
5. `PauseOverlay`. Its Leave calls `host.leave()`. `onIdleEscape` closes the settings modal, else the pause menu, else opens the pause menu in a match (`client/ui/settings.md`).
6. `Screens`, with `me` from `session.selfName`, `endLabel`, `onBack` = `host.leave()` and `onScreen` = hide the pause menu (`client/ui/screens.md`).
7. `ClientLink` (`client/app/client-link.md`).
8. `AudioEngine` and the action and intent sound wrappers (`client/audio/`).
9. `Actions` (`createActions`). Its pick callback is `link.pick(x, y)`.
10. `Input`, `Renderer`, `Hud` (gets `vision` and the same `guide`).
11. `host.attach(link)`.
12. `startLoop({...})` (`client/app/frame-loop.md`). `autoSiegeOn` is false while a guide runs (`link.tutoring`) and when the setting is off.

Nothing else creates these objects. Add a new long-lived object here and pass it down.

## main.ts

`apps/client/src/main.ts` is the page entry of `index.html`.

1. It builds a `LocalHost` whose `onHome` shows the start screen.
2. `startClient(host)`.
3. It reads the map files (`client/app/map-assets.md`) and builds the `StartScreen` on `#start` (`client/ui/start-screen.md`). The screen's handlers call `host.skirmish`, `host.tutorial` and `host.sandbox`.
4. `play(begin)` runs one of them and hides the start screen if the host became active (`LocalHost.active()`). A match that did not start leaves the start screen up.

`index.html` holds only `<div id="start" class="screen backdrop">` and the module script. All other markup comes from the shell.

A page that is not this one can call `startClient` with its own host and lay its own screens over the canvas. The canvas shows the backdrop whenever no match or placement is on.
