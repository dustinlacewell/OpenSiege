Not built. Part of the hierarchical bot proposal (`shape.md`). The plan interface and the allocator are built (`docs/architecture/ai/allocation.md`, `docs/architecture/ai/loop.md`). This file lists what is not built: plans opened from goals, plan state, and the plan types.

# Plans

A plan carries out one goal. It has a small state machine, and it asks for units.

## Goals and state

Today `PlanKind` has `requests(board, mem, knobs)` and `run(plan, members)`, and each plan is a fixed slot in the registry. The requests read the commander's goals, and the goal scores set their scores (`docs/architecture/ai/production.md`). Later steps add the rest:

- `open(goal, board)` makes a plan's state when the commander raises a goal. A plan closes when its goal goes.
- A plan holds its own state, not shared memory slices.

A new plan type is a new file that registers itself. Nothing else changes.

## Plan types

| Plan | States | Asks for |
|---|---|---|
| `factory` | sieged, moving, fleeing | the factory; engineers until its build speed matches its share of income; a reserve of tanks sized to the danger near it |
| `field` | working, evacuating, closed | harvesters |
| `defend` | gather, engage, done | tanks with power at least `k` × the danger at the target |
| `attack` | gather, march, siege, fight, retreat | the main army: tanks, artillery, engineers, a radar and a jammer |
| `raid` | sneak, strike, escape | a few tanks or mobile mines, sized to the guard at the field |
| `sweep` | search, engage, done | tanks with power to beat the guessed guns; it searches the approach out to 2200 |
| `hunt` | search, chase | fast tanks; it searches cells by last sighting, field wealth and age |
| `picket` | post, hold | one sieged mine or radar truck on an approach, as hidden eyes |
| `scout` | out, back | one fast unit |
| `mine` | lay, done | mines for the spots on one approach |

## Key behaviours

- **Factory site.** Each `factory` plan picks its own site with `safestNear`, scored by field wealth. A move has a cost: the factory builds at 1 instead of 4 on the road, and it loses 60 ticks to pack and siege. It moves only when the better site gains more than that within the time the fields there last. Extra factories keep apart, so one raid cannot kill them all.
- **Early move.** When danger is coming but not yet in reach, the factory moves while it still has time.
- **Under tank attack: stay.** Tanks are faster than a factory, so running only loses the siege armor and the build speed. The factory stays sieged. Its engineers heal it, it builds defenders, and the commander raises `protect factory`.
- **Under shelling: move or sweep.** Sieged artillery is slow to follow: it must pack (25 ticks) and moves at 20. The factory moves out of the guessed gun range when that takes less time than the guns need to kill it. Meanwhile a `sweep` goes after the guns.
- **Field under attack.** When a harvester takes damage, the `field` plan sends its harvesters away from the danger. The commander opens a `defend` goal for the field. If no defender comes in time, the field closes until its danger fades.
- **Sized defense.** The `defend` plan asks only for the power it needs.
- **Mines.** The `mine` plan puts mines across an approach, spaced so one blast does not set off the next. A blast hurts every team, so a mine never sits on a field or path that own or allied units use.
- **Pickets.** A jammer hides an army from radar, but not from sight. A sieged mine sees 700 and stays hidden, so it is a cheap picket on an approach. It warns before a jammed army reaches the factory.
- **Siege push.** The `attack` plan sieges its artillery out of the range of the enemy guards (artillery reaches 2200, a sieged tank 800). Its tanks screen the guns. When the enemy factory runs, the tanks chase it. A factory moves at 12 and a tank at 30.
