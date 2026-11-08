Source: packages/ai/src/plan/support.ts, packages/ai/src/plan/escort.ts, packages/ai/src/plan/follow.ts

# Support planner

Owns engineers and radar trucks.

## Engineers

- With a main squad: the first 2 engineers guard its lowest-id tank.
- The rest siege at the factories. The k-th goes to factory k mod the factory count, so the factories share them evenly.
- Each one stands on a ring 250 round its factory, at its own angle, so they do not stack. Its goto is done within 250 of the spot, so it sieges inside the work range (600) of the factory.

Only a sieged engineer in work range of a factory adds build speed (`ai/production.md`). The work range is `ENGINEER_REACH` in `plans/asks/buildSpeed.ts`, which both the plan and the ask read.

A guard heals near its target (`sim/systems/guard.md`). A sieged engineer heals every friendly in work range (`sim/systems/repair.md`). The guard task only changes when the target changes.

## Radar trucks

A sieged radar truck senses 5500 units, far past any sight. The bot uses it to fill the threat map and to find targets.

- Anchor: 800 back from the main squad centre, toward home. Staging with no squad.
- Stay deployed when within 600 of the anchor (2000 once deployed) and not in danger.
- Else drive to the anchor.

The stay-or-go rule and the 80-tick hold are shared with artillery (`ai/artillery.md`).
