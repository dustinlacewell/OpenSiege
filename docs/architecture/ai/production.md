Source: packages/ai/src/produce/produce.ts, packages/ai/src/produce/demand.ts, packages/ai/src/produce/choose.ts, packages/ai/src/produce/armyKind.ts, packages/ai/src/produce/stale.ts, packages/ai/src/plans/asks/wanted.ts, packages/ai/src/plans/asks/economy.ts, packages/ai/src/plans/asks/army.ts, packages/ai/src/plans/asks/artilleryShare.ts, packages/ai/src/plans/asks/support.ts, packages/ai/src/plans/asks/buildSpeed.ts, packages/ai/src/plans/asks/base.ts

# Production

Production builds what the plans asked for and did not get. The plans ask from the commander's goals (`ai/command.md`).

## Asks

Each plan asks for its kinds with `wantedAndRest`: a request for the wanted count at a score, then one for every other unit of the kind at a low score. So the plan still holds every unit of its kinds. Only the first request can be unfilled. Its missing part is the build demand. Its score is in credits, for the missing units only.

- **Economy.** Each work-field goal splits into its slots, each at an equal share of the goal score. The best slots, at most `harvesterTarget`, are the wanted harvesters. The score is that of the slots past the harvesters the bot has.
- **Army and artillery.** The missing power is the larger of the summed protect needs and the best attack's need, plus every defend need. It is bought in tank units: the army wants what it has plus that many. The counter mix splits the army (`artilleryShare`, below). The goal scores go to the missing units, split by count.
- **Temporary army floor.** Until sized field defense lands (`docs/future-work/ai-hierarchy/order-of-work.md`), the army wants at least `minSquad` tanks, so the bot still launches attacks. A floor tank scores at least its cost.
- **Support.** Engineers: one per 2 credits that income is above build speed, on top of those the bot has, up to 3 times `Knobs.engineers`. Income is 5 a tick per sieged harvester in a field, 1 per mobile one. Build speed is each factory's work rate (4 sieged, 1 mobile) plus 2 per sieged engineer within work range of a factory. Each missing engineer scores 500, its build work over 250 ticks. Radar trucks: `radars` once the army has 5, at 250 each.
- **Base.** One more factory, below `factoryTarget`, when the summed protect scores pass a factory's cost. Its score is that sum.

## Artillery share

- Blind share: 0.45.
- Counter share: 0.15 plus 0.35 times the tank fraction of the known enemy tanks and artillery. Many enemy tanks: shell them. Enemy artillery: rush it with tanks.
- The share is the blend `blind × (1 − mixQuality) + counter × mixQuality`.

## Each run

Production is a step slot, every 10 ticks. It reads `Memory.unfilled`, which the allocator set this think.

1. Demands: the unfilled requests, summed per kind (`demandsFrom`).
2. Cancel: queued jobs past the demand for their kind, from the back of each queue. The head job of a queue stays, because its progress would be lost. A cancel refunds the full cost.
3. Take the jobs still queued off each demand.
4. Each factory with fewer than 2 jobs, in id order, gets one job from `choose`. Credits are tracked across factories within the run.

## Choose

- Value is the demand's score over the cost of the whole demand.
- When the bank covers one unit of every open demand, credits are not the limit. Queue time is. Then value is the score over the build ticks of the whole demand. This is how a factory gets built while the army asks.
- Build the best value if the credits cover it. Else build the best affordable demand worth at least half the best. Else build nothing and save.
- Tank and artillery are one army demand. Whichever wins, the factory builds the army kind with more units missing that the credits cover (`armyKind`).
