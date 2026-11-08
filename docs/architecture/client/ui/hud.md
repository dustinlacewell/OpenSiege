Source: apps/client/src/ui/hud.ts, apps/client/src/ui/leaderboard.ts, apps/client/src/ui/portraits.ts

# HUD

The HUD is DOM. `Hud` composes the panels and refreshes them at a low rate.

## Hud

`new Hud(session, cam, actions, portraits, vision, guide = NO_GUIDE)`. `startClient` builds it after the `Renderer` and passes `renderer.portraits` and the one `Vision`, which goes to the `Minimap`. `guide` is the tutorial seam (`client/game/tutorial/core.md`). `app/frameLoop.ts` calls `hud.update(now)` every frame.

- Minimap redraw: every `MINIMAP_MS` (100).
- Everything else: every `HUD_MS` (200). `refresh` builds a `HudModel` (`client/ui/model.md`) from the world and a `HudView` of the session (`me`, `selected`, `page`, `targetMode`, `groupOf`) and the guide (`guide`, `guideView = guide.view()`), and gives it to each panel.
Parts it owns: top bar (`credits`, `units` text), `UnitPanel`, `CommandCard`, `Leaderboard`, `Minimap`, `EliminatedBanner`, `GuidePanel` (`client/ui/guide-panel.md`). The start, pick and end screens are not HUD parts (`client/ui/screens.md`).

All HUD markup sits in `#game-hud`. `Screens` shows it only in a match and under the end card. `Hud` does not know the screen; it keeps refreshing while hidden.

## The console

Three fixed boxes along the bottom edge, on one baseline. Each is 216 px tall with 200 px inside. Sizes are fixed in CSS, not driven by content. The minimap box is always visible. `UnitPanel` and `CommandCard` hide their boxes (`hidden`) when `hasSelection` is false. The boxes are absolutely placed, so hiding one moves nothing else.

| Box | Position | Inside | Owner |
|---|---|---|---|
| `#minimap-box` | left | 200 by 200 minimap | `Minimap` (`client/ui/minimap.md`) |
| `#unit-panel` | centre, 440 px wide | selected units, queue band | `UnitPanel` (`client/ui/unit-panel.md`) |
| `#command-card` | right, 344 px wide | build grid, Siege, Stop, Guard, Attack, tooltip | `CommandCard` (`client/ui/build-grid.md`) |

The console needs a window at least about 1030 px wide. Narrower, the boxes overlap.

## Portraits

`Portraits` (`portraits.ts`) is the one seam to the unit headshots: `url(kind)`, or `""` until ready. The renderer implements it (`client/render/portraits.md`). `ui/` never imports `render/`. Images are set with `setSrc`. An `<img>` without `src` is invisible (CSS).

## Leaderboard

`Leaderboard.update(rows)` compares `JSON.stringify(rows)` with the last one. It rebuilds the list only if it changed. Names use `colorCss`. The local player's row has class `me`.

## Rules

- Panels read the model. They do not read the `World`. Compute new values in `model.ts`.
- Panels write to the DOM only through `ui/dom.ts` helpers, so unchanged values cost nothing.
- A panel that needs an action takes `Actions` in its constructor. It never builds an intent.
- Panels know no tutorial. They read `locked` and `focus` flags from the model (`client/ui/model.md`).

## Recipe: add a HUD panel

1. Add the markup with an id in `index.html` (`client/ui/markup.md`).
2. Add the data it shows to `HudModel` and `hudModel` in `ui/model.ts`.
3. Write a class in `ui/` that finds elements with `byId` in its constructor and has `update(model)`.
4. Construct it in `Hud` and call its `update` from `refresh`.
