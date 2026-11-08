Source: packages/ai/src/index.ts, packages/ai/src/bot.ts, packages/ai/src/decide.ts, packages/ai/src/plans/registry.ts, packages/ai/src/plans/types.ts, packages/ai/src/plans/commandStep.ts, packages/ai/src/plan/plan.ts, packages/ai/src/knobs.ts, packages/ai/src/rng.ts

# The bot loop

`packages/ai` (`@mf/ai`) is a computer player. It runs in the match host, not in the client's sim. It sends the same intents a human client sends.

## The seam

- `createBot({ difficulty, seed })` returns a `Bot`.
- The host calls `think(world, me)` after every sim step. `me` is the bot's player id.
- `think` returns intents for the next turn. It never writes `world`.
- The bot is not part of lockstep. It needs no determinism. It uses its own seeded roll (`rng.ts`, mulberry32) for variety.

## One think

`bot.ts` joins the knobs, the roll, the memory and the map study. Each call:

1. Skip unless `(tick + phase) % thinkEvery === 0`. `phase` comes from the seed, so bots do not think on the same ticks.
2. `perceive(world, me)`: build the `Picture` (`ai/perception.md`). A dead player does nothing.
3. On the first live think, `studyMap(world)` makes the map study. The bot keeps it for the match (`ai/terrain/study.md`).
4. `decide(picture, memory, knobs, roll, study)`: returns the intents and the new memory.

`decide.ts` reads top-down:

1. Remember: update ghosts and explored cells.
2. Board: build the board and keep its memory slices (`ai/board.md`).
3. Allocate: every plan states its requests, due or not. The allocator gives each own unit to at most one plan. The allocation and the unfilled requests go into memory (`ai/allocation.md`).
4. Assess: the threat map from the board's known ghosts (`ai/assessment.md`). The planners get the known ghosts, the threat map, the groups and the board. The ported planners do not read the board yet.
5. Run each slot that is due. A plan slot runs with its members, in `pic.own` order. A step slot runs with no members. Each returns a `PlanResult`: unit tasks, direct intents and the memory slices it owns. Its slices go into memory before the next slot runs.
6. Emit: turn the tasks into intents, with order hygiene (`ai/orders.md`). At most 40 intents per think.

## Plans and schedule

A `PlanKind` (`plans/types.ts`) has an `id`, `requests(board, mem, knobs)` and `run(plan, members)`. `plans/registry.ts` lists the slots in run order. Each runs when its period has passed. `offset` staggers the first runs.

| Slot | Every (ticks) | Asks for |
|---|---|---|
| command | 20 | nothing; a step that scores goals (`ai/command.md`) |
| base | 20 | every factory |
| economy | 10 | every harvester |
| production | 10 | nothing; a step that builds (`ai/production.md`) |
| army | 5 | every tank |
| artillery | 5 | every artillery |
| support | 10 | every engineer and radar truck |

Each plan asks for a wanted count of its kinds, from the goals, and then for every other unit of those kinds (`plans/asks/`, `ai/production.md`). No two plans ask for the same kind, so each kind still has one owner. The requests read the goals of the last command run, so a new goal reaches them one think later. The commander runs first. Base runs next because the others read the site. Army runs before artillery and support because they follow its squads.

## Plan

`plan/plan.ts` holds the shared shapes. `Plan` is plain data plus the roll. `Home` is the factory site and the staging spot the base plan chose (`ai/base.md`). New units rally to staging.

## Knobs

`knobs.ts` holds one `Knobs` row per difficulty. There is one brain. Only the numbers differ.

| Knob | easy | normal | hard |
|---|---|---|---|
| `thinkEvery` | 8 | 4 | 2 |
| `reactionDelay` | 80 | 30 | 8 |
| `attackRatio` | 0.9..1.3 | 1.3..1.7 | 1.2..1.5 |
| `minSquad` | 4 | 6 | 8 |
| `retreatRatio` | 0.35 | 0.7 | 0.85 |
| `mixQuality` | 0 | 0.6 | 1 |
| `harvesterTarget` | 2 | 4 | 7 |
| `factoryTarget` | 1 | 3 | 6 |
| `engineers` | 0 | 2 | 3 |
| `radars` | 0 | 1 | 1 |
| `maxSquads` | 1 | 2 | 2 |
| `scout` | no | yes | yes |

`engineers` caps the engineers at 3 times its value. Engineers are built while income is above build speed (`ai/production.md`).

`danger` holds the scar half-lives of the danger map, the same for every difficulty (`ai/danger-map.md`). `enemyIncome` (8) and `insurance` (0.3) are also the same for every difficulty (`ai/worth.md`, `ai/command.md`).

Easy reacts late, attacks with small squads, fights to the death, ignores the enemy mix and has one factory. Hard reacts fast, counters the enemy mix and scales to six factories.
