Source: apps/client/src/ui/roster/model.ts, apps/client/src/ui/roster/seatItem.ts, apps/client/src/ui/roster/sectionItem.ts, apps/client/src/ui/teamModel.ts

# Roster

The roster lists the seats of a match setup. It is one list in a free-for-all (`teams` 0) and one section per team in a team game. The skirmish setup card uses it (`client/ui/skirmish/setup-card.md`). It exports from `@mf/client` so other pages can use it. The rules for teams are in `sim/seat-teams.md`; this file is how the client shows them.

## Model (pure, `roster/model.ts`)

Types only. A screen builds the sections from its own state (the skirmish does it in `client/ui/skirmish/model.md`).

- `SeatView` is a player (`name`, `tag`, `note`, `me`) or a bot (`id`, `name`, `difficulty`). `tag` is the text after the player's name. `note` is the text at the seat's right edge. Either is "" when there is none.
- `SectionView`:
  - `team`: the team number. Null in free for all, which has no header.
  - `name`: "Team 1" for team 0. "" in free for all.
  - `color`: the palette index of the team colour. Null in free for all.
  - `count`: "n / cap". "" in free for all.
  - `seats`: players, then bots, in seat order.
  - `canJoin`: a click on the header moves the local player here.
  - `canAddBot`: a bot may be added here: there is a free seat and the team has room.
- Free for all: one section holding every seat in seat order. `canJoin` is false.
- Team game: one section per team, `0` to `teams - 1`, in order. Empty teams are listed.

## teamModel.ts (pure)

- `TEAM_CHOICES`: 0, then 2 to `MAX_TEAMS`.
- `modeLabel(teams)`: "Free for all" or "N teams".
- `choiceLabel(teams)`: the selector labels: "Free for all", "2", "3", "4".
- `teamCapacity(teams)`: seats one team holds. Free for all: `MAX_SEATS`.
- `teamName(team)`: "Team 1" for 0.
- `teamColor(team)`: the palette index, equal to the team number.
- `mayJoinTeam(teams, mine, team, count)`: the game has teams, `mine` exists and is not a spectator, is not on this team, and the team has room.
- `byTeam(seats)`: allies together, lowest team first. Seats of one team keep their order.

## View

`sectionItem(section, actions)` in `sectionItem.ts` builds one `<section class="team">`:

- The header, in a team game. The team name in the team colour and the seat count. It is a button (`title` "Join team") when `canJoin`; a click calls `actions.join(team)`. Otherwise it is a plain block.
- The seat list (`seatItem`).
- A "+ Bot" button, when `actions.addBot` is set. It is disabled when `canAddBot` is false. A click calls `addBot(team)` with the section's team; in free for all the team is null.

`seatItem(seat, actions)` in `seatItem.ts`:

- Player row: the name, the `tag` after it, and the `note` at the right. The local row has class `me` (gold).
- Bot row: the name and the difficulty. The difficulty is a button that calls `cycle(id)` when set, else plain text. A × button calls `remove(id)` when set.

A button shows only when its action is set. `RosterActions` is `SeatActions` (`remove`, `cycle`) plus `addBot` and `join`.

Styles: `section.team`, `.team-head`, `.team-count`, `ul.seats`, `li.me`, `li.bot`, `.bot-level`, `.bot-remove`, `.add-bot`, `.seat-tag`, `.seat-note` (`client/ui/markup.md`).
