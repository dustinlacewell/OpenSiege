Not built. Part of the hierarchical bot proposal (`shape.md`). The commander, its score, the protect, work-field, attack, defend and scout goals, insurance and hysteresis are built (`docs/architecture/ai/command.md`). This file lists what is not built.

# The commander: what is left

## Goals

| Goal | Gain | Worth at risk |
|---|---|---|
| `raid field F` | the enemy harvesters' worth, with their lost income | the raiders |
| `sweep A` | the worth that unseen shooters on approach A are hurting | the sweepers |
| `hunt` | the worth of an enemy factory whose place is not known, times the chance to find it | the hunters |
| `picket A` | the worth near A times the share of surprise it removes | the picket |
| `mine approach A` | the danger that passes through A, as expected kills | the mines |

## Rules

- **Goals steer units.** Today only production reads the goals. Plans open from goals, and the allocator splits units by goal score (`allocation.md`, `plans.md`).
- **Shelling.** A hurt event with no seen shooter opens a `sweep` goal on the approach it came from. Sweepers search out to artillery range (2200). Defending at the factory does not help, because the guns are not there.
- **Killed worth.** The fog estimate of enemy worth subtracts the enemy worth the bot has killed.
- **One chance rule.** Protect and attack use the own power there now. Defend uses the power the goal would get. All goals should use the power the goal would get.

## Knobs

- Score noise. Easy adds noise, so it makes plain mistakes.
- Which goal types are allowed. Easy has no mines, jammers, pickets or raids.
