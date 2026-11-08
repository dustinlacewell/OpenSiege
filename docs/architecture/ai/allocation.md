Source: packages/ai/src/plans/allocate.ts, packages/ai/src/plans/types.ts, packages/ai/src/plans/asks/wanted.ts

# The allocator

`allocate(asked, own, prev, steal)` gives each own unit to at most one plan. It is pure. `decide` calls it once per think, before the slots run. The result goes into `Memory.allocation` and is `prev` at the next think.

## Requests

A `Request` asks for units of one kind, in one role.

- `count`: how many. `Infinity` takes every unit there is.
- `power`: if set, the request stops once the units taken sum to this power (`ownPower`).
- `score`: the order. The highest score is served first.
- `near`: nearer units go first.

## Rules

1. Requests go by score, highest first. Equal scores keep the order they were asked in.
2. A request takes units of its kind in this order: units it held last time, then free units, then units another plan holds. In each tier, nearest first. Ties go by `pic.own` order.
3. A unit is held while its plan still asks for its kind in the same role. Otherwise it is free.
4. A unit another plan holds moves only if `steal(unit, holder, by)` says yes. Today `noSteal` always says no. Switch cost and protected plan states go here (`docs/future-work/ai-hierarchy/allocation.md`).
5. A request that runs out of units is returned in `unfilled`, cut to what is missing. A request with `count: Infinity` and no `power` is never unfilled. `decide` keeps `unfilled` in `Memory.unfilled`. Production builds for it (`ai/production.md`).

`membersOf(allocation, own, plan)` returns a plan's units in `pic.own` order.

## Today

Every plan asks with `wantedAndRest`: the wanted count from the goals, then every other unit of its kinds at a low score, in the same role (`ai/production.md`). No two plans ask for the same kind. So each plan still holds every unit of its kinds, in `pic.own` order.
