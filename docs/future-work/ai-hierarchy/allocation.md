Not built. Part of the hierarchical bot proposal (`shape.md`). The allocator itself is built (`docs/architecture/ai/allocation.md`). This file lists what it does not do yet.

# The allocator: stealing units

Today a unit another plan holds is never taken. The `steal` hook in `plans/allocate.ts` always says no. A later step, once plans open from goals, fills it with these rules.

## Rules

1. Taking a unit from another plan has a switch cost: the score that plan loses, plus the travel time of the unit. The unit moves only if the new score minus the switch cost beats its current plan.
2. A plan that is marching, sieging or fighting gives up units only to a factory in danger.

## Why this fixes the raid rush

A `defend` request asks for a set power, not for every tank. The allocator stops when that power is met. It takes the nearest free units first, such as a factory's reserve. The main army pays a switch cost, and when it is on the move rule 2 protects it.
