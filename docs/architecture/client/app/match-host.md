Source: apps/client/src/app/matchHost.ts, apps/client/src/game/placement.ts

# MatchHost and MatchLink

The seam between the client and whatever runs its match. The host feeds turns in. The client sends intents out. The client never reaches past it.

## MatchHost (the client calls it)

```
attach(link: MatchLink)                // once, from startClient
intent(as: number, intent: Intent)     // the local player's intent. `as` is session.self. Never join or leave
checkpoint?(tick, hash)                // every HASH_EVERY ticks: the hash of the world the client stepped
leave()                                // the pause menu's Leave, the end card's button
desync()                               // the client's world fell out of step, or a turn was missed. Start over
```

`checkpoint` is optional. A host without a reference world leaves it out (`net/desync-check.md`).

## MatchLink (the host calls it)

```
deliver(msg: MatchMsg)       // welcome, turn, ended or desync (net/match-messages.md)
world(): World | null        // the world the client stepped, or null outside a match
paused(): boolean            // true while the tutorial guide stops time
view(): TutorialView | null  // what the tutorial reads each frame, or null until the camera is home
guide(guide: Guide | null)   // the tutorial's guide, or null. A guide also switches auto-siege off
sandbox(on: boolean)         // on: this client commands every side and picks one from the leaderboard
endCard(kind: EndKind)       // "match" (Victory or Defeat) or "tutorial" (the thank-you card)
place(placement | null)      // the choose-your-start phase; null ends it
stop()                       // drops the match, the placement and the end card: the backdrop shows again
```

`ClientLink` implements `MatchLink` (`client/app/client-link.md`). `LocalHost` implements `MatchHost` (`client/app/local-host.md`).

## Placement

`Placement` (`game/placement.ts`) is the choose-your-start phase as the client sees it: a world to look at, a panel to show and a click to answer. The host owns its state. The client reads it each frame. See `client/game/placement.md`.

## Invariants

- The client calls `attach` once. A host must not call the link before that.
- `intent` carries no `join` or `leave`. The host drops them if they come.
- On `desync` the client has already stopped its session. On `leave` it has not. The host calls `link.stop()` itself in both cases.

## Recipe: add a host

1. Implement `MatchHost`. Keep the `MatchLink` from `attach`.
2. On start: `link.place(...)` for a choose-your-start phase, then `link.deliver({t:"welcome",...})`.
3. Each tick: `link.deliver({t:"turn",...})`. At the end: `link.deliver({t:"ended",...})`.
4. Pass the host to `startClient`.
