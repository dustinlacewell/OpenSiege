Source: apps/client/src/ui/screens.ts, apps/client/src/ui/screenLayout.ts, apps/client/src/ui/endOverlay.ts, apps/client/src/ui/endModel.ts

# Screens: pick, match, end

`Screens` holds the one screen state of a match. It has the shape of `ScreenEvents` in `match/handler.ts`, so the handler drives it without knowing the DOM. With no screen at all, the canvas shows the backdrop. A page lays its own home screens over it (the start screen, `client/ui/start-screen.md`).

```
new Screens(handlers)
screens.picking(placement)  // the choose-your-start screen
screens.drawPick(now, cam, terrain)  // per frame: pick panel and markers
screens.match()             // no screen; the game HUD shows
screens.inMatch()           // true on the match screen
screens.ended(winners)      // the end card over the dimmed, frozen match
screens.tutorialEnded()     // the end card with the tutorial's thanks instead of a result
screens.idle()              // no match, no pick, no end card
```

`show(screen)` changes nothing when the screen is already current.

`Screens` builds `PickView` (`client/ui/pick.md`) and `EndOverlay`.

`ScreenHandlers` is what `startClient` binds:

- `me()`: the local player's name (`session.selfName`). The end card compares it with the winners.
- `endLabel`: the end card's button label for a match. A page sets it with `ClientOptions.endLabel`.
- `onBack()`: the end card's button. `startClient` binds it to `host.leave()`.
- `onScreen(screen)`: the screen changed. `startClient` hides the pause menu.

## Flow

pick → match → ended → idle.

`ClientLink` drives it: `place` calls `picking`, the handler calls `match` and `ended`, `stop` calls `idle` (`client/app/client-link.md`).

## screenLayout.ts (pure)

`Screen` is `"pick" | "match" | "ended"`. `null` is no screen. `layoutOf(screen)` says what shows:

| Screen | Pick | End card | Game HUD |
|---|---|---|---|
| `pick` | yes | | |
| `match` | | | yes |
| `ended` | | yes | yes |
| `null` | | | |

The game HUD is `#game-hud`, one wrapper around the top bar, leaderboard, console and the eliminated banner. `Screens` hides it with `setHidden`.

What the canvas draws does not depend on the screen. It depends on the session: a lockstep draws the match, a pick world draws the pick scene, else the backdrop (`client/app/backdrop.md`, `client/app/pick-scene.md`).

## EndOverlay

`#end`, a 320 px panel on a dim layer. The match HUD stays visible under it.

- `show(result)`: writes an `EndResult` (`endModel.ts`, pure): the title, its tone, the line and the button label.
- `endResult(winners, me, button)`: no winners: title "Draw" and "No winner". The local name is in `winners`: "Victory". Else "Defeat". The line is the names joined with ", " and "wins" for one name, "win" for more. The button text is the `button` argument.
- `TUTORIAL_END`: "Thanks for playing!", an invitation to a real game, and the button "Play a real game".
- `#end-back` calls `onBack` either way.
- `hide()`.
