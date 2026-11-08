Source: packages/ai/src/board/board.ts, packages/ai/src/bot.ts, packages/ai/src/board/hurt.ts, packages/ai/src/board/delay.ts, packages/ai/src/board/recent.ts, packages/ai/src/board/fields.ts, packages/ai/src/board/approaches.ts

# The board

The board is the one shared view for a think. It is a pure function of the picture and memory. `decide` builds it after it updates the ghosts (`ai/loop.md`).

The commander (`ai/command.md`) and the plan requests (`ai/production.md`) read the board. The ported planners still get the same known ghosts, threat map and groups as before.

## What it holds

- `pic`: the picture.
- `known`: ghosts old enough to react to (`ai/perception.md`).
- `groups`: enemy groups of the known ghosts (`ai/assessment.md`).
- `allies`: allied units from the picture.
- `danger`: the danger map, live plus scar (`ai/danger-map.md`).
- `hurts`, `losses`: own damage events released this think.
- `recent`: events released in the last 200 ticks (`RECENT`), this think's included. `keepRecent` keeps them in `Memory.recentEvents`, so the commander, which runs every 20 ticks, sees them all.
- `fields`: one state per resource field.
- `approaches`: where danger comes from, per factory and per worked field.
- `study`: the map study, made once per match and passed in (`terrain/study.md`).

`buildBoard(pic, mem, knobs, forgotten, study)` also returns the memory slices it owns: `lastHp`, `pendingEvents`, `recentEvents`, `scar` and `scarTick`. `forgotten` is the ghosts memory dropped this think (`forgottenGhosts`). They feed the sight scar.

## Hurt events

`hurtEvents(lastHp, own, tick)` compares own units with `Memory.lastHp`, their hp and place at the last think.

- An hp drop is a hurt: unit, kind, place, amount, tick, and the rate in hp per tick over the gap since the last think.
- A unit that is gone is a loss, at its last place. It carries the rate of its last drop, or 0.
- An hp rise is a repair. It is no event.

## Reaction delay

New events wait in `Memory.pendingEvents`. `releaseEvents` lets out each event once `tick - event.tick` is at least `Knobs.reactionDelay`. Only released events go on the board and into the scar. So easy bots react late to damage too.

## Fields

`fieldStates` gives each field its id, place, amount, `dangerAt` its centre, and `ownPower`: the power of own and allied units within 1500 of the centre.

## Approaches

`approaches` makes one entry per own factory and per field an own harvester stands in. Each has `at` (`"factory"` or `"field"`), the id, the place and `dir`. `dir` is the sum, over cells within 3000, of danger times the unit vector from the place to the cell, normalised. It is null when the sum is about 0.
