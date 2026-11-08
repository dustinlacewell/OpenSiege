Source: apps/client/src/game/skirmish/placement.ts, apps/client/src/game/placement.ts

# Skirmish placement

`skirmishPlacement(args)` makes the skirmish's choose-your-start phase as a `Placement` (`client/game/placement.md`).

```
SkirmishPlacementArgs { spec, plan, seed, onPick(spot), onLeave() }
```

- `world`: `createWorld(spec)`. The terrain and no players.
- `you`: the human's player id.
- `view`: constant. Title "Pick your start", no countdown, the rows of the plan, and the bots' spots as marks (`skirmishSeats`, `client/game/skirmish/world.md`).
- `onPick(x, y)`: calls `args.onPick(clampSpot(spec, x, y))`.
- `leave`: calls `args.onLeave`.

The rows list everyone: allies together, lowest team first, seat order inside a team. Only the bots show as picked.

`LocalHost.skirmish` builds it and gives it to `link.place` (`client/app/local-host.md`).
