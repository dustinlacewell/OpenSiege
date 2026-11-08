Source: apps/client/src/game/skirmish/plan.ts, apps/client/src/game/skirmish/planErrors.ts

# Skirmish plan

A skirmish is a match against computer players on this machine. The plan says who sits where. It is plain data. The setup card makes it (`client/ui/skirmish/model.md`). The world builder reads it (`client/game/skirmish/world.md`).

## Data

```
SkirmishSeat  = { kind: "human", team } | { kind: "bot", name, team, difficulty }
SkirmishPlan  { name, teams, seats }
SkirmishSetup { draw: MapDraw, plan: SkirmishPlan, auto: boolean }
```

- Seat `i` is player `i + 1`.
- `teams`: 0 is free for all, else 2 to `MAX_TEAMS`. In free for all every seat has its own team number.
- A plan has exactly one human seat and at most `MAX_SEATS` seats.
- `SkirmishSetup` is what Play hands to the host. `draw` is the map (`map/draw.md`). `auto` says the start spot is chosen for the player.

## planErrors(plan) (pure)

Gives one line per fault. An empty list means the plan can be played.

- Not exactly one human seat.
- More than `MAX_SEATS` seats.
- A bad team count (`validTeams`, `sim/seat-teams.md`).
- A team number that is not an integer from 0.
- In free for all: two seats with the same team number.
- In a team game: a team number past the count, or a team over its cap (`teamCap`).

`skirmishWorld` and `skirmishSeats` throw when `planErrors` is not empty.
