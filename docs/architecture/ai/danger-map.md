Source: packages/ai/src/danger/grid.ts, packages/ai/src/danger/live.ts, packages/ai/src/danger/scar.ts, packages/ai/src/danger/query.ts

# The danger map

The danger map says how much enemy power can hit each place. Every value is in power units (`ai/assessment.md`), never in credits. The board builds it each think (`ai/board.md`).

The commander reads the danger map (`ai/command.md`). The ported planners still read the threat map (`ai/assessment.md`).

## Grid

`DangerGrid` is `{ cell: 400, cols, rows, values }`, sized like the threat map: `ceil(width / 400)` by `ceil(height / 400)` cells. `values` is one `Float64Array`, row-major.

- `stamp(grid, x, y, power, reach)` adds `power` times a falloff to each cell whose centre is within `reach`. The falloff is 1 out to half the reach, then falls in a straight line to 0 at the reach. It writes the grid in place. Callers stamp only grids they made this think.
- `fade(grid, factor)` returns a copy with every cell times `factor`.

## Live layer

`liveDanger(known, m)` is built fresh each think from the known ghosts. Each armed ghost stamps `ghostPower` over `reachOf`, the threat map's reach. So a deployed gun reaches `siegeRange`, a mobile unit `range` plus 400, and a radar contact counts as 0.6 of a tank with a tank's reach.

## Scar layers

`Scar` is three grids: `sight`, `damage` and `loss`. It lives in `Memory.scar`. `updateScar` runs each think, in this order:

1. Fade. Each layer is multiplied by `0.5 ^ (ticks since the last think / half-life)`. The half-lives are in `Knobs.danger`: sight 300, damage 600, loss 1200 ticks, for every difficulty.
2. Sighting. Each ghost that memory forgot this think stamps half its power over its reach into `sight`, at its last place. A ghost adds no scar when it leaves sight. It still counts in the live layer until memory forgets it.
3. Damage. A hurt event with no known armed ghost in reach of the hurt unit stamps into `damage` out to 2200, artillery range. The power is that of one sieged artillery gun, times the damage rate over one gun's siege damage rate. A hurt with a seen shooter adds nothing. The live layer already holds the shooter.
4. Loss. Each loss event stamps into `loss` the same way. It uses the rate of the unit's last hp drop, or one gun if it was never hurt.
5. Clearing. A cell an own eye sees, with no live danger, has its `sight` set to 0. The eye reach follows the explored-cell rule: `sight`, at least 600. Sight never clears `damage` or `loss`, because guns fire from out of sight.

Hurt and loss events reach the scar only after the reaction delay (`ai/board.md`).

## Queries

`Danger` is `{ live, scar }`.

- `dangerAt(d, x, y)`: live plus the three scar layers at the cell.
- `dangerAlong(d, a, b)`: the most danger on the line from `a` to `b`, sampled once per cell length.
- `safestNear(d, m, p, r, score)`: the cell centre within `r` of `p` with the best `score(cell) - dangerAt(cell)`. Cells off the map are left out. It returns null when no cell fits.
