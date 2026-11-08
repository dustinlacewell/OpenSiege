Source: packages/ai/src/command/command.ts, packages/ai/src/command/goal.ts, packages/ai/src/command/context.ts, packages/ai/src/command/protect.ts, packages/ai/src/command/field.ts, packages/ai/src/command/attack.ts, packages/ai/src/command/defend.ts, packages/ai/src/command/scout.ts, packages/ai/src/command/cluster.ts, packages/ai/src/command/hysteresis.ts, packages/ai/src/plans/commandStep.ts

# The commander

`command(board, mem, knobs)` returns the goals the bot could pursue, each with a score in credits (`ai/worth.md`). It is pure. It moves no units.

It runs as the first step slot, every 20 ticks (`ai/loop.md`). Its goals go into `Memory.goals` and stay there until the next run. The plan requests read them (`ai/production.md`).

## Goal

`Goal` is `{ id, kind, at, score, need }`. `need` holds what the goal still lacks: a unit kind and count, or a power. A power need is net: the power missing at the place, after the own power already there.

`commandContext` is built once per run. It holds own worth, the fog estimate of the enemy, the insurance danger, and `edge`, the middle of `Knobs.attackRatio`. `friendlyPower` sums own and allied power near a place.

## Goals

In each line, `p` is a `chance`.

- `protect:<factory>`, one per own factory. The danger is the larger of `dangerAt` the factory and the insurance. Insurance is `Knobs.insurance` (0.3) times `enemyPowerEstimate`. So the danger is never zero, and a reserve is bought before the first attack. `near` is the own and allied power within 1500. Need: `edge × danger − near`. Score: `factoryWorth × (1 − p(near, danger))`.
- `field:<field>`, one per field worth working. That is the economy plan's rule over the board: at least 400 left, and danger less 0.7 of own power at most 15. Slots: one per 1250 credits left, 1 to 3. Each slot scores `5 × min(amount ÷ 5, 250) × p − harvesterWorth × (1 − p)`, with `p = chance(own power, danger)` at the field. The goal score is the slot score times the slots. Need: that many harvesters.
- `attack:<lowest member id>`, one per known enemy group. Gain: the members' loss worth, with enemy factories at the enemy life premium. The army is all tanks plus 0.6 of the artillery's deployed power. Score: `gain × p(army, group) − army worth × (1 − p)`. Need: `edge × group power − army`.
- `defend:<lowest unit id>`, one per cluster of recent hurt and loss events. The board keeps released events 200 ticks (`ai/board.md`). Events within 800 of each other form one cluster. Defenders bring 1.3 times the danger at the cluster centre. Need: that less the own power within 1500. Gain: the loss worth of own units within 1500. Risk: the need in tanks, at tank cost. Score: `gain × p − risk × (1 − p)`, with `p` at the power the defenders bring.
- `scout`, when `Knobs.scout` is on and some scout cell has gone 3000 ticks unseen. Score 100. It sits at the oldest cell. Nothing reads it yet.

## Rules

- **Hysteresis.** A goal whose id was in the last run gets 15% on a positive score.
- Goals at or below zero drop out.
- The commander does not steer units yet. Only production reads the goals, through the plan requests.
