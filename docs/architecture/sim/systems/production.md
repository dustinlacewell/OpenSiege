Source: packages/sim/src/systems/production.ts, packages/sim/src/systems/quota.ts, packages/sim/src/jobs.ts, packages/sim/src/intents.ts, packages/sim/src/intents/quota.ts, packages/sim/src/stats.ts

# Production

Factories turn credits and time into units.

## Queue

- `Unit.queue` is a list of `{ id, kind, progress }`. The head is in progress. `id` comes from `world.nextId++` when `build` queues the job.
- The `build` intent checks: the unit is an own `factory` and `kind` is in `BUILDABLE`. Then it calls `enqueueJob`.
- `enqueueJob(world, owner, factory, kind)` (`jobs.ts`): needs `cost` credits and fewer than `MAX_QUEUE` (30) jobs. It charges `cost` and pushes a job. `build` and quota top-up both use it, so their rules cannot drift.
- Cost is paid at enqueue, in full.
- The `cancel` intent `{ factory, jobs }` removes each listed job id from an own factory and gives back its full `cost`. That is exactly what `build` charged. Progress on a cancelled head job is lost. An id not in the queue does nothing. Ids, not positions, so a job that finished before the cancel lands never makes another job go.
- If the factory dies, queued jobs are lost with no refund.

## Quota

- `Unit.quota` maps a kind to a count, 1..`MAX_QUOTA` (20). A missing kind is 0.
- The `quota` intent `{ factory, kind, delta }` adds `delta` on an own factory for a `BUILDABLE` kind and clamps to 0..20. At 0 the key is deleted.
- `fillQuotas(world)` (`systems/quota.ts`) runs first in `production`. For each living factory, in unit id order, and each kind in `UNIT_KINDS` order: if the owner's living units of that kind plus this factory's queued jobs of that kind are below the quota, `enqueueJob` queues one. At most one job per kind per factory per tick.
- Living units count over the owner's whole army. Queued jobs count only in this factory. So two factories with the same quota can each queue jobs before the first unit is out.
- Only arrays and `UNIT_KINDS` set the order. Nothing iterates the quota object's keys.

## production(world)

First `fillQuotas`. Then this runs for every factory with a non-empty queue.

1. `progress += workRateOf(factory) + boostOf(world, factory)`. The first is 1 mobile, 4 sieged, 0 in transition. The second is the work of engineers on this factory (`sim/systems/repair.md`).
2. If `progress < buildTicks[kind]`, stop.
3. Shift the job off the queue. Extra progress is discarded.
4. Pick an exit direction: `EXITS[world.nextId % 8]`. Eight directions, scaled by 1000.
5. Spawn the unit at the factory position plus the direction times `factory radius + unit radius + 20`.
6. If the factory has a `rally`, the new unit gets a `move {rally.x, rally.y, group: factory.id, attack: false}` order in `orders` (`types.ts`).
7. With no `rally`, the new unit gets `guard {target: factory.id, chase: false}` (`sim/systems/guard.md`). A harvester gets no order. It stays idle, so the idle-harvester key finds it (`client/game/commands.md`).

## Rally

- `rally` intent sets `Unit.rally` on own factories only.
- A `move` intent clears the rally of every factory that takes it, queued or forced (`sim/intents.md`). Every factory takes the move, so every factory loses its rally.
- With a rally, the new unit starts with exactly one order, that `move`. It has no other orders and `arrived = 0`.
- Client: `game/orderLines.ts` draws the rally mark for selected factories.

## Invariants

- Quota jobs take their ids before any unit spawns this tick.
- The unit takes its id from `spawnUnit` (`nextId++`), so the exit direction depends on the id counter. Keep this deterministic: no extra `nextId` use between `EXITS` pick and `spawnUnit`.
- The list of factories is taken before the loop, and `spawnUnit` pushes onto `world.units`. This is safe because the loop walks a separate array.

## Client reads

`ui/queueModel.ts` computes percent and seconds left from `progress`, `buildTicks` and the mode, and groups the jobs into runs (`client/ui/queue.md`). `render/overlay.ts` draws a build bar above own factories.
