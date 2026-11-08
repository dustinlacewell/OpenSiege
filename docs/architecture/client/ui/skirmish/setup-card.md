Source: apps/client/src/ui/skirmish/skirmishView.ts, apps/client/src/ui/skirmish/skirmishParts.ts, apps/client/src/ui/skirmish/skirmish.css

# Skirmish setup card

`#skirmish`, a panel of fixed size (720 by 420 px) on the start screen (`client/ui/start-screen.md`). Fixed sizes, so nothing reflows as seats come and go. Two columns: 280 px on the left, the rest on the right.

Left column (`.side`):

- The map tile (`#skirmish-map`, 280 by 280 px) with a `‹` and a `›` button at its edges. A click on the tile or on `›` steps to the next map. `‹` steps back. Same tile as `client/ui/map-tile.md`.
- The heading "Teams" and the team selector: a segmented row with one button per `TEAM_CHOICES`: Free for all, 2, 3, 4. The button of the current count is on.

Right column (`.main`):

- The roster (`.roster`): one block per team, or one block in free for all. It scrolls (`client/ui/roster.md`).
- The note line (`.note`): the `problem` text, or empty.
- The foot: the name field (max 16 characters, placeholder "Your name") and the checkbox "Auto start spot".
- The actions: the gold Play button and a plain Tutorial button. Play is disabled while `problem` is not null.

## SkirmishView

```
new SkirmishView(draws, nameSlot, handlers: SkirmishHandlers)
view.root
SkirmishHandlers { onPlay(setup: SkirmishSetup), onTutorial() }
```

- The state is a `SkirmishState` (`client/ui/skirmish/model.md`). Each control calls a model step and redraws.
- The name starts from `nameSlot`. Input updates the state. A `change` or a Play saves it to `nameSlot`. Enter blurs the field.
- Play finds the draw whose `info.id` equals `mapId` (the first draw if none), checks `problem`, saves the name and calls `onPlay({ draw, plan: toPlan(state), auto })`.
- `draw()` redraws the map tile, the selector, the roster, the checkbox, the note and the Play button. The roster actions are `addBot`, `join`, `remove` and `cycle`, each a model step.

## skirmishParts.ts

Small DOM builders: `node`, `button`, `mapFrame(onStep)` (the tile with its two arrows), `teamChoice(onPick)` and `checkbox(label, onChange)`.
