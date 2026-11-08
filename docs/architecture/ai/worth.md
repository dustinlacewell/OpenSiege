Source: packages/ai/src/worth/unit.ts, packages/ai/src/worth/own.ts, packages/ai/src/worth/enemy.ts, packages/ai/src/worth/chance.ts

# Worth

Every commander score is in credits (`ai/command.md`). These pure functions give the credit worth of units, of each side, and the chance of a fight.

## Units (`unit.ts`)

- `unitWorth(kind, hp)`: cost times the hp fraction. Full hp when hp is not known.
- `harvesterWorth(hp)`: the unit worth plus the income lost until a new harvester is at work: 5 a tick for `REPLACE_TICKS` (250). That is 1250 more.
- `factoryWorth(lifePremium, hp)`: the unit worth, plus 1200 of build work lost (4 a tick for the 300 ticks a new factory takes), plus the life premium.
- `lossWorth(kind, hp, lifePremium)`: what losing the unit costs. A factory and a harvester use the two rules above. Other kinds use the unit worth.

## Own side (`own.ts`)

`ownWorth(pic)` is the player's credits, its units at their hp, and the cost of its queued jobs. Allies are not counted, because only the player's own lives carry its premium. `lives` is the number of own factories, at least 1. `lifePremium` is worth divided by lives. So the last factory carries the whole player.

## Enemy under fog (`enemy.ts`)

`enemyWorth(known, tick, income)`:

- Worth is the larger of the seen worth and `START_CREDITS + tick × income`. `income` is `Knobs.enemyIncome`, 8 for every difficulty.
- The seen worth sums the known ghosts at their last hp. A radar contact of unknown kind counts as 0.6 of a tank, as in its power.
- Killed enemy worth is not taken off the guess yet.
- Lives are the known enemy factories, at least 1.

`enemyPowerEstimate(worth)` is the enemy army the guess allows: 0.4 of the worth, in tanks, times one tank's power.

## Chance (`chance.ts`)

`chance(own, enemy)` is `r² ÷ (1 + r²)` with `r = own ÷ enemy`. No enemy gives 1.
