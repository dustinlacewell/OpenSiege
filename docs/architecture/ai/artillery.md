Source: packages/ai/src/plan/artillery.ts, packages/ai/src/plan/escort.ts, packages/ai/src/plan/follow.ts

# Artillery planner

Artillery is weak mobile and strong sieged (range 2200, splash). Deploy and pack take 25 ticks. So the planner decides, per gun, to stay deployed or to drive.

## Anchor

- With a main squad: 500 units back from the squad centre, toward home. The main squad is the biggest one not retreating (`escort.ts`).
- With no squad: the staging spot.

## Stay or go

A gun wants to stay when:

- Mobile: a known enemy is within 0.9 of `siegeRange`, it is within 2500 of the anchor, and its spot is not in danger. Or it is home, within 700 of staging.
- Deployed: it has a target and is within 2500 of the anchor. Or it is home. Or it is in danger but has a target; packing under fire is slower than fighting.

Danger (`inDanger`) means the threat on the spot is more than twice the own power within 1200.

Stay gives `siege {on}`. Go gives `goto` the anchor. The sim fires a sieged gun at the nearest enemy in reach, seen or not. The bot only places it.

## Hold

`follow.ts` keeps a choice for 80 ticks before it may flip back. `Memory.modeSince` holds the last choice and its tick per unit. This stops deploy and pack flip-flop.
