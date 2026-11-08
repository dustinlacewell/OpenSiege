# Teams (`teams.ts`)

`Player.team` is a number set by the `join` intent (`team`, default `-id`). Players with the same team are allies. A player alone on its team is a free-for-all player.

- `teamOf(players, id)`: the team of player `id`. An unknown player stands alone: `-1 - id`.
- `sameTeam(players, a, b)`: the same player, or the same team.
- `isEnemy(players, a, b)`: not `sameTeam`. It is the one test for who may be picked as a target.

`isEnemy` decides targets in `targeting.ts` (`nearestEnemy`, `densestEnemy`), `guard.ts` (`guardEnemy`), and the `attack` intent (an order on an ally is ignored). It also scores spawn points: only enemy units count as rivals (`spawn.ts`). Orders still need `unit.owner === player`: you command your own units only.

Nothing protects allies from damage. A blast hurts every unit in its radius (`systems/projectiles.md`). A direct shell stops at the first body of any unit but the one that fired it.

`join` sets `color` to `(team >= 0 ? team : id) % 12`, so teammates share a colour and a free-for-all match keeps distinct colours.

`team` is in `hashWorld` and in the world codec.
