Source: packages/ai/src/plan/army.ts, packages/ai/src/plan/squads.ts, packages/ai/src/plan/targets.ts, packages/ai/src/plan/raid.ts

# Army planner

Owns the tanks. Tanks not in a squad are the pool. The pool waits sieged at staging. When tanks siege: `ai/tank-siege.md`.

## Each run

1. Find a raid (`raid.ts`): known ghosts within 1800 of a factory, or of a harvester within 5000 of the site.
2. Step each squad (`squads.ts`). A squad that is home from a retreat dissolves into the pool.
3. Keep or pick the scout.
4. Launch the pool as a new squad, if it can.
5. Tasks: squad members siege in place when in contact, else drive to the squad goal. The pool drives to the raid, else to staging and sieges there. All with attack-move, except a retreat and the scout.

## Squad states

A squad has a `goal` (where it drives now), a `target` (what the attack is for) and its own ratio `k`.

- `defend`: a raid is on and the squad is within 5000 of the site. Goal is the raid. When the raid ends, the squad retreats home.
- `retreat`: power below `retreatRatio` times the enemy power at the squad centre (below). Goal is staging. Within 900 of staging the squad dissolves.
- `gather`: the squad was strung out past 1400. It meets at the member nearest the target. It resumes when tight (700) or after 300 ticks.
- `attack`: drive to the target. On arrival, or when no group stands at the target, pick a new one. A scouting squad switches as soon as it finds a target.

Squad power includes 0.6 of the deployed power of artillery within 2200. The guns follow the main squad (`ai/artillery.md`).

## Launch

The pool launches when all hold:

- No raid, at least `minSquad` tanks, fewer than `maxSquads` squads out.
- A target it beats (below). Or no enemy group is known at all; then it scouts.

With no squad out, the launch power also counts 0.6 of all artillery, deployed. Artillery counts from anywhere within twice the long map side. `nextK` is rolled again after each launch.

## Targets (`targets.ts`)

`enemyPowerAt(point)` is the ghost power within 1500, or the threat map value there, whichever is more. The threat map adds deployed guns that hit from 2200 away.

`pickTarget` takes the enemy group with the best `value / (1 + distance / near)`, where `near` is a quarter of the short map side (4000 on the default map), among groups where the force has at least `k` times `enemyPowerAt` the group.

`scoutPoint` scores each scout cell: staleness, times a bonus for distance from home, less a pull toward the mirror of the site across the map centre, less a little for distance (distances are in units of the map diagonal, `mapDiagonal`), plus some jitter. Spawns are random, so the mirror point is only a first guess.

## Focus fire

An attacking squad within 1200 of its target, with no armed or unknown contact within 1000, fires an `attack` at a seen enemy factory first, else a harvester. An attack-move alone would shoot the nearest thing.

## Scout

With `scout` set, one free tank scouts stale cells without fighting. It picks a new cell on arrival. Scouting stops at tick 6000, after 2 scouts, or once an enemy factory is known. The scout then joins the pool.
