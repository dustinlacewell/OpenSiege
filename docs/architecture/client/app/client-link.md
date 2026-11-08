Source: apps/client/src/app/clientLink.ts, apps/client/src/app/matchHost.ts

# ClientLink

`ClientLink` is the client's side of the host seam. It implements `MatchLink` (`client/app/match-host.md`). `startClient` builds one from `{ host, session, cam, guide, screens, now }` and gives it to `host.attach`.

## What it does

- `deliver(msg)`: runs `handleMatch` with `step`, `hashWorld` and an `onHash` that calls `host.checkpoint?.(tick, hash)`. Its `restart` is `host.desync()`. Its screen events are `match()` and `ended(winners)` (`client/match/handler.md`).
- `world()`: `session.world`.
- `paused()`: `guide.paused()`.
- `view()`: the tutorial's read: `{ world, me, selected, camera }`. Null until the camera is home (`session.homed`), so the jump home does not count as the player's pan.
- `guide(guide)`: sets the `GuideSlot` (`NO_GUIDE` for null) and the `tutoring` flag.
- `sandbox(on)`: sets `session.sandbox`.
- `endCard(kind)`: remembers the kind. At `ended`, kind `"tutorial"` shows `screens.tutorialEnded()`, else `screens.ended(winners)`.
- `place(placement)`: a placement stores it, calls `session.startPick(you, world)` and `screens.picking(placement)`. Null clears it, and if the session still holds a pick world it calls `stop()`.
- `stop()`: clears the placement, `session.stop()`, the guide, the end kind (back to `"match"`) and `screens.idle()`.
- `pick(x, y)`: a click on the ground in the choose-your-start phase. It calls `placement.onPick(x, y)`. `Actions` calls it through `chooseSpot` (`client/app/pick-scene.md`).
- `tutoring`: true while a guide runs. Auto-siege is off then, because it sends past the guide.

## Invariants

- The link holds no match state. `Session` does.
- The end card kind resets on `stop()`, so the next match shows a normal result.
