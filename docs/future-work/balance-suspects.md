Not built. Stats that look out of balance. Bot-versus-bot matches (`ai-hierarchy/order-of-work.md`) measure each one before any change.

# Balance suspects

Numbers from `packages/sim/data/unitStats.json` and `docs/architecture/sim/systems/`.

## Engineer boost has no limit

A sieged engineer adds 2 build speed for 200 credits. A factory adds 4 for 4500. Per credit, the engineer is about 11 times better, and nothing caps how many engineers can boost one factory. The best play is a sieged factory with a ring of engineers. Factories then matter only as lives.

Options: cap the engineers per factory, or make each extra engineer add less.

## Harvesters pay back very fast

A harvester costs 300 and earns 5 a tick sieged. It pays back in 60 ticks (6 seconds). Each field holds 5000, so one harvester earns about 17 times its cost before its field is dry. Early play is "build harvesters" with no real choice.

Options: cost more, earn less, or take longer to build.

## Mines are cheap for what they kill

A mine costs 150. Its blast does 500 within 200. That kills a tank (250 credits) and most of a harvester (300), and it hurts every unit near it. A mobile mine is the fastest unit (40), and it drives to the densest enemy clump. A line of sieged tanks or harvesters can lose several units to one mine.

Options: less blast damage, a smaller blast, a higher cost, or a slower mine.
