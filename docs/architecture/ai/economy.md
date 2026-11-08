Source: packages/ai/src/plan/economy.ts

# Economy planner

Harvesters earn 5 credits a tick sieged and 1 mobile, only inside a field (`sim/systems/economy.md`). A sieged harvester drains a full field in about 1000 ticks. So the planner keeps one harvester per field and moves them often.

## Each run

1. Keep claims. A harvester keeps its field while the field is workable.
2. Claim. Each other harvester takes the best workable field with no harvester on it.
3. Tasks. A harvester with a field gets `goto` its slot with `siege`. One with no field goes to staging.

`Memory.harvest` holds the claims, harvester id to field id.

## Workable

- At least 400 credits left.
- Threat at the field, less 0.7 of the own power within 1500, is at most 15. One enemy tank is more than that. So a harvester leaves a raided field, unless own units guard it.

## Score

`amount / FIELD_AMOUNT / (1 + distance to harvester / 3000) / (1 + danger / tank power)`. Danger is `dangerAt` the field centre on the board's danger map. Tank power is `unitPower` of one mobile tank. Full fields near the harvester, with little danger, win. Distance to the factory does not count: a sieged harvester earns wherever the factory stands.

## Slots

The first harvester on a field stands at its centre. Later ones stand 220 units out. Today one harvester per field is the cap, so slots past the first are unused.

A harvester earns only inside the field disc. So its `goto` sets `arrive`: the field radius less 60 at the centre slot, and the radius less 280, at least 80, at a later slot. A harvester that sieges short of that, or is pushed off, gets the goto again (`ai/orders.md`).
