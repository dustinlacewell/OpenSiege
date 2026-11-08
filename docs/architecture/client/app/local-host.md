Source: apps/client/src/app/localHost.ts, apps/client/src/match/localMatch.ts, apps/client/src/game/skirmish/world.ts, apps/client/src/game/tutorial/match.ts, apps/client/src/dev/sandboxWorld.ts

# LocalHost

`LocalHost` is the offline `MatchHost` (`client/app/match-host.md`). It hosts one match at a time on a `LocalMatch` clock (`client/match/local-match.md`). The match has scripted bots, the tutorial or the dev sandbox. It exports from `@mf/client/localHost`.

```
new LocalHost({ onHome?, every?, seed? })
host.active()            // true from the start of a match or of its start-spot pick, until the player leaves it
host.play(plan)          // plays a LocalPlan { world, you, bots }
host.skirmish(setup)     // a match against bots on a map from setup.draw
host.tutorial()          // the offline tutorial, gated by its lesson
host.sandbox()           // dev only: a two-side match where this client commands every side
```

Options:

- `onHome()`: the player leaves, or the end card asks to go home. `main.ts` shows the start screen.
- `every(ms, fn)`: the turn clock. Defaults to `setInterval`. Tests inject a fake.
- `seed()`: the seed of a skirmish. It makes the generated map and the bots' start spots. Defaults to a random 32-bit number.

## skirmish(setup)

`setup` is a `SkirmishSetup` (`client/game/skirmish/plan.md`).

1. Draw the spec: `setup.draw.spec(seed)`. A throw is logged and nothing starts.
2. Halt any running match.
3. With `setup.auto`, play at once with the start spot from the seed.
4. Else set `placing`, and call `link.place(skirmishPlacement(...))` (`client/game/skirmish/placement.md`). The bots' spots are marked. A click calls `playSkirmish` with the clicked spot. Leave goes home.

`playSkirmish` builds the starting world with `skirmishWorld` (`client/game/skirmish/world.md`) and plays it. A bad plan is logged and the pick stays.

## tutorial()

Reads `tutorialMatch()` (`game/tutorial/match.ts`): the world, the local and enemy players and the lesson. A throw is logged and nothing starts. It builds a `TutorialGuide` (`client/game/tutorial/core.md`) that reads `link.view()`. Then `link.guide(guide)`, `link.endCard("tutorial")`, and it runs the match with `tutorialEnemy(...)` as the one bot.

## sandbox()

`sandboxWorld(Date.now() >>> 0)` with `you` = `SANDBOX_SIDES[0]` and no bots. Then `link.sandbox(true)`. That flag means "this client commands every side".

## Run and halt

- `run(plan)` builds a `LocalMatch` with `deliver` = `link.deliver`, `world` = `link.world`, `paused` = `link.paused`. It starts it with the world, `you` and the bots.
- `halt()` stops the match, clears `placing` and calls `link.stop()`. That drops the guide and the end card too.
- `play(plan)` is `halt()` then `run(plan)`.
- `intent(as, intent)` goes to `match.send(as, intent)`. With no match it does nothing.
- `leave()` is `halt()` then `onHome()`. `desync()` is `leave()`.

`LocalHost` has no `checkpoint`. It holds no reference world, so no hash check runs.

## Invariants

- One match at a time. `play`, `skirmish`, `tutorial` and `sandbox` halt the old one first.
- A host that is not attached throws on the first use of the link.
