Source: apps/client/src/game/placement.ts, apps/client/src/app/clientLink.ts

# Placement

`Placement` is the choose-your-start phase as the client sees it: a world to look at, a panel to show and a click to answer. A host builds one and gives it to the client with `link.place(placement)` (`client/app/match-host.md`). The host owns the state. The client reads `view(now)` each frame.

```
Placement {
  world: World                    // the terrain to look at: no players
  you: number                     // the local player id
  view(now): PlacementView        // the panel and the marks at time `now`
  onPick(x, y)                    // a click on the ground chose the spot (x, y)
  leave()                         // the panel's Leave button
}
PlacementView { title, countdown, rows, marks }
PlacementRow  { name, team, picked, me }
PlacementMark { id, x, y, name, team, me }
```

- `countdown` is `"m:ss"` while the choice is open, and `""` when it is not. The panel hides an empty countdown.
- `rows` are grouped by team, lowest first. `team` is the colour.
- `marks` hold one spot each. `id` is the player id.

## Who draws what

- `ClientLink.place` starts the pick scene: `session.startPick(you, world)` (`client/app/pick-scene.md`) and `screens.picking(placement)`.
- `PickView` draws the panel and the markers (`client/ui/pick.md`).
- A click on the ground goes through `Actions.chooseSpot` to `placement.onPick` (`client/app/pick-scene.md`).
- `placement.leave` is the panel's Leave button.

The skirmish's placement is in `client/game/skirmish/placement.md`.

## Invariants

- The view is pure data. The client never changes a placement.
- A host ends the phase with `link.place(null)` or by starting the match.
