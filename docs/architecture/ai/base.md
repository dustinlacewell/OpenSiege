Source: packages/ai/src/plan/base.ts, packages/ai/src/plan/plan.ts

# Base planner

Owns the factories' place. A factory builds 4 times faster sieged, so the planner keeps every factory deployed.

## Site

`Memory.site` is where the main factory (the oldest one) lives. The first run takes its spawn point. A site holds for at least 1500 ticks. After that:

1. Flee shelling. The threat on the site is more than twice the own power within 1500, but no known enemy is within 1600. That is long-range fire the base cannot answer. The site moves 2500 away from the shooters, if the threat is lower there.
2. Anchor behind the front. The planner takes the primary front (`front.md`). The wanted spot is on the line from the front back to the site, `BACKSET` from the front. `BACKSET` is the artillery siege range plus 800, so enemy artillery at the front cannot reach the factory. The planner then takes the safest danger cell within 1200 of the wanted spot. 1000 of distance from the wanted spot weighs as much as one tank's power of danger.
3. Else stay.

The anchor move happens only when both are true:

- The new spot is more than 2000 from the site. Small front shifts do not move the factory.
- The straight road to the new spot crosses no more danger than half a tank's power.

With no front known, the factory stays. The site never moves toward richer fields: a sieged harvester earns on its field wherever the factory stands.

So new units appear near the fight, and the army stands between the enemy and the factory.

The planner writes the front it used to `Memory.front`.

## Factory tasks

- The main factory stands on the site. Extra factories stand on a ring 450 out.
- Within 250 of its spot, a factory gets `siege {on}`. Else `goto` with `siege`.

## Rally

The planner picks the staging spot and writes it to `Memory.staging`. With a front, it is the hold spot on the road from the site to the front (`terrain/hold-spot.md`). With no front, or no hold spot, it is the default rule: 700 from the site toward the front, or toward the map centre (`defaultStaging`, `plan/plan.ts`). `homeOf` reads `Memory.staging`, and uses the default rule before the first base run. Every reader of staging goes through `homeOf`.

Every factory's rally is kept on the staging spot. One `rally` intent covers all factories that are off it. A factory move clears the rally (`sim/intents.md`), so this run also restores it.
