Source: apps/client/src/match/localMatch.ts, apps/client/src/match/localOutcome.ts, apps/client/src/app/localHost.ts, apps/client/src/game/tutorial/match.ts

# Local match

`LocalMatch` is the offline turn clock. It sends the `MatchMsg`s a match host sends. They go through the client's own `handleMatch` (`client/match/handler.md`), so the client runs a local match as it runs any other.

## API

```
new LocalMatch({ deliver, world, every?, paused? })
match.start(world, you, bots = [])   // welcome, then the turn clock
match.send(player, intent)           // queue an intent for the next turn
match.stop()                         // cancel the clock, drop the queue
```

- `deliver(msg)`: the client's match-message path (`MatchLink.deliver`).
- `world()`: the world the client stepped. The end rule and the bots read it.
- `every(ms, fn)`: runs `fn` every `ms` and returns a cancel. It defaults to `setInterval`. Tests inject a fake.
- `paused()`: while it returns true, time stops. It defaults to never.
- `LocalBot` is `{ player, think(world, me) -> Intent[] }`. It has the shape of a `@mf/ai` bot's `think`. `match/` does not import `@mf/ai`; the caller passes the bots in.

## Turn flow

- `start` delivers `welcome` with the world and `you`, then runs a turn every `TICK_MS`. The first turn carries `world.tick + 1`.
- A clock beat while `paused()` is true does nothing: no turn, no end check, no bot thinks. The tick does not advance. Queued intents wait for the first turn after the pause.
- A turn delivers `{t:"turn"}` with the next tick and all intents queued since the last turn. Each intent is stamped with its player.
- After the turn, the end check runs. `localOutcome(players)` says the match is over when at most one team has an alive player. The winners are every player on that team. Then the match stops and delivers `ended { winners }`.
- Else each bot thinks on `world()` with its own player id. Nothing thinks when `world()` is null. The intents are queued for the next turn with the bot's player.
- `join` and `leave` are dropped, from `send` and from bots.
- A bot keeps at most 60 intents per turn (`MAX_LOCAL_BOT_INTENTS`).
- A bot that throws gives no intents for that turn. Its first throw is logged once with `console.warn`. The match keeps ticking.

## Use

`LocalHost` builds one `LocalMatch` per match and calls `start` (`client/app/local-host.md`). While a match runs, `host.intent(as, intent)` goes to `match.send(as, intent)`. The pause flag is `link.paused()`, which is the tutorial guide's pause.

### Dev sandbox

`LocalHost.sandbox()` plays `sandboxWorld(seed)` with no bots, then sets `session.sandbox = true`. That flag means "this client commands every side". `sandboxWorld` lives in `apps/client/src/dev/`.

### Tutorial

`LocalHost.tutorial()` reads `tutorialMatch()` (`game/tutorial/match.ts`): the world, the local and enemy players and the lesson. It builds a `TutorialGuide` (`client/game/tutorial/core.md`) and runs the match with `tutorialEnemy(lesson, guide, enemy)` as the one bot. The end card is the thank-you card, never Victory or Defeat (`client/app/client-link.md`). The match pauses while a note shows. The tutorial does not set `session.sandbox`. Auto-siege is off while it runs, because auto-siege sends past the guide.

### Skirmish

`LocalHost.skirmish()` plays a world built by `skirmishWorld` against bots made by `createBot` (`client/game/skirmish/world.md`).

## Invariants

- Bots think on the stepped world after each turn, `join` and `leave` are dropped, intents are capped, and a throw gives none.
- It does not know the DOM or the sandbox world.
