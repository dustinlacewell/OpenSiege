Source: packages/sim/src/seatTeams.ts, packages/sim/src/seats.ts

# Seats and team numbers

A match setup has seats: players and bots. Each seat has a team number. `seatTeams.ts` holds the pure rules that place seats on teams. `seats.ts` holds the limits. All of it exports from `index.ts`. The skirmish setup uses it (`client/ui/skirmish/model.md`).

`teams` is the setup's team count. 0 is free for all: every seat has its own unique number. Otherwise it is 2 to `MAX_TEAMS`, and every seat's team is in 0 to `teams - 1`. `Player.team` in the world is set from this number by the `join` intent (`sim/teams.md`).

## Limits (`seats.ts`)

- `MAX_SEATS` = 8: players and bots in one match. Bots can be added only below it.
- `MAX_TEAMS` = 4: the most teams in a team match.

## Steps (`seatTeams.ts`, all pure)

- `validTeams(teams)`: 0, or an integer in 2 to `MAX_TEAMS`.
- `teamCap(teams)`: `floor(MAX_SEATS / teams)`. The seats one team holds. `teams` is 2 to `MAX_TEAMS`.
- `teamSizes(used, teams)`: seats per team, indexed by team number. A number outside 0 to `teams - 1` is not counted.
- `teamHasRoom(used, teams, team)`: `team` is a team of a `teams` match and holds fewer than `teamCap` seats. False in free for all.
- `emptiestTeam(used, teams)`: the team with the fewest seats that still has room. Ties go to the lowest number. Null if all are full.
- `freeTeam(used)`: the lowest number that no seat in `used` holds. Free for all uses it, so no two seats are allies. It is not bounded by `MAX_SEATS`.
- `rehome(seats, from, to)`: new team numbers for `seats` (in seat order) when the match goes from `from` teams to `to` teams. `from` and `to` differ.
  - To free for all: seat `i` gets number `i`.
  - From free for all: each seat in turn takes the emptiest team.
  - Between team counts: a seat stays if its team still exists and is under the new cap (taken in seat order). The others take the emptiest team with room, in seat order.

`used` is the list of team numbers the seats hold now.
