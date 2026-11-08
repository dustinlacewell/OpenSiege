Source: packages/ai/src/tasks.ts, packages/ai/src/emit/emit.ts, packages/ai/src/emit/due.ts

# Tasks and order hygiene

Planners do not write intents for units. They hand out tasks. The emitter sends an intent only when a task changes or a unit drops it. So the bot never spams orders.

## Task

`Task` is a goal for one unit:

- `goto {x, y, attack, siege, arrive?}`: drive there. `attack` makes it an attack-move. `siege` deploys on arrival. `arrive` is the distance within which the goto is done.
- `siege {on}`: deploy or pack where it stands.
- `guard {target}`, `attack {target}`.

`taskKey` gives equal tasks equal keys. A goto key includes `arrive`, because each unit in a group keeps the first unit's task.

## Assignments

`Memory.assignments` maps a unit id to its current task, the tick it was last sent and the size of the group it went with.

`emit` runs once per think:

1. Merge. Dead units drop out. A fresh task replaces the old one only if `sameTask` says it differs. Two gotos with the same flags and points within 400 are the same. So a goal that drifts a little sends nothing.
2. Find the due units (`due.ts`). A new task is due at once. An old task is due again only after 30 ticks, and only if the unit dropped it.
3. Group due units by task key. Each group is one intent, so the sim gives them a formation.
4. Stop at the cap. The rest wait for the next think.

## Dropped

- `goto`: the unit is idle and mobile or sieged, and it is not near the point, or its mode is wrong for the `siege` flag. Near is `arrive` when the task sets it. Else it is 300 plus 60 per formation row of the group. A sieged unit that is not near gets the move again; the move packs it first.
- `siege`: idle and still in the other mode.
- `guard`: the head order is not this guard.
- `attack`: idle.

## Intents

- `goto`: one `move` with `force: true`, so a deployed unit packs. With `siege`, a queued `siege {on: true}` follows.
- `siege`, `guard`, `attack`: one intent each, not queued.
