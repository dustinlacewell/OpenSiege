Source: apps/client/src/ui/skirmish/skirmishModel.ts, apps/client/src/ui/skirmish/skirmishSections.ts, apps/client/src/game/skirmish/plan.ts

# Skirmish setup model

The state of the setup card and the steps on it. Pure. Every step returns a new state and changes nothing in place.

## State

```
SkirmishState { mapId, teams, humanTeam, bots, nextBot, name, auto }
BotSeat       { id, difficulty, team }
```

- `mapId`: the library map's stem, or null for a generated map.
- `teams`: 0 is free for all, else 2 to `MAX_TEAMS`.
- The human is always seat 0, on `humanTeam`. The bots follow in the order they were added. `nextBot` is the id the next bot gets.
- `name`: the name field, as typed. `auto`: start without choosing a spot.
- `initialSkirmish(name)`: free for all, the generated map, one "normal" bot, `auto` off.

## Steps

- `canAddBot(s, team)`: under `MAX_SEATS` seats and, in a team game, `team` (any team when null) has room.
- `addBot(s, team)`: adds a "normal" bot. Free for all: the lowest free team number (`freeTeam`); `team` is ignored. Team game: `team`, else the emptiest team. No change when it does not fit.
- `removeBot(s, id)`.
- `cycleBot(s, id)`: steps the bot to the next difficulty (`DIFFICULTIES` order), wrapping from the last to the first.
- `joinTeam(s, team)`: moves the human to `team`. No change in free for all, for a bad number, or for a full team.
- `setTeams(s, teams)`: sets the team count and re-homes the seats with `rehome` (`sim/seat-teams.md`). No change for a bad value, the same value, or more seats than the teams hold.
- `setMap(s, mapId)`, `stepMap(s, ids, by)` (the next or previous map in `ids`, wrapping; an id not in the list steps from the first), `setName`, `setAuto`.
- `playerName(s)`: the name as played: trimmed, cut to `NAME_MAX` (16), and "Player" when empty.
- `problem(s)`: why the match cannot start, or null. "Add an opponent" with no bots. "At most 8 seats". "A team is full". "Put an opponent on another team" when every bot is on the human's team.
- `toPlan(s)`: the `SkirmishPlan` (`client/game/skirmish/plan.md`). Bots are named "Bot N" by id. Throws when `problem` is not null.

## skirmishSections(s) (pure)

The roster blocks for `sectionItem` (`client/ui/roster.md`). Free for all: one block, `canAddBot` from `canAddBot(s, null)`. Team game: one block per team, empty teams included, with `count` "n / cap", `canJoin` from `mayJoinTeam` and `canAddBot` from `canAddBot(s, team)`. The human's row has `me` set and no tag or note. Bot rows carry their id and difficulty.
