Not built. A proposal to replace the current bot brain (`docs/architecture/ai/loop.md`).

# Hierarchical bot: the shape

## Why change

The current bot has six planners. Each planner owns one unit kind. Nothing above them decides what the bot is trying to do. This causes the known faults:

- No planner can borrow a unit from another. Tanks cannot defend a far harvester. Engineers cannot reclaim scrap for the economy.
- The bot has no signal for damage. It reacts only to enemies it remembers seeing.
- Nothing sizes a response. A raid near the base pulls in every tank in the pool.
- The bot treats the factory site as a fixed home. The factory is mobile, and it is the bot's life.
- The threat grid has hard edges and no memory. A place where the bot lost units counts as safe if nobody saw the attacker.
- Jammers and mines have no owner, so the bot never builds them.

## The vision

The bot wins by out-earning, keeping its factories alive, trading well and then taking the enemy factories. Every layer scores its choices in one measure: the expected change in credits balance over a horizon. See `vision.md`.

## The layers

Strong RTS bots converge on the same split (UAlbertaBot, Steamhammer, 0 A.D. Petra, Zero-K CircuitAI). We use it too.

| Layer | Job | Method | Runs every |
|---|---|---|---|
| Board | One shared view of the world for this think, with the danger map | pure derivation | think |
| Commander | Many goals at once, each with a score | utility scores | 20 ticks |
| Plans | One plan per goal. Each asks for units and runs a small state machine | state machines | 5–10 ticks |
| Allocator | Gives units to plans by goal score and distance | greedy match | when plans run |
| Production | Builds what plans asked for and could not get | best score per credit | 10 ticks |
| Tactics | Turns a unit's role in its plan into a task | per-role rules | think |
| Emit | Turns tasks into intents, with order hygiene | as today | think |

Each layer reads the layer above it and the board. No layer reaches down past the one below it.

## Data flow in one think

1. `board = buildBoard(picture, memory)` (`docs/architecture/ai/board.md`).
2. If due: `goals = command(board, memory.commander, knobs)` (`commander.md`).
3. Plans sync to the goals. New goals open plans, and goals that are gone close their plans (`plans.md`).
4. If due: each plan updates its state and states its unit requests.
5. `allocate(requests, units)` gives each unit to at most one plan (`allocation.md`).
6. If due: `produce(unfilled requests, budget)` returns build intents (`production.md`).
7. `tactics(plan, role, unit, board)` returns a task per unit (`tactics.md`).
8. `emit` sends the changed tasks, as today.

Steps 1–7 are pure functions on plain data. The roll is passed in. Only `bot.ts` holds state.

## What stays

- The `Bot` seam: `think(world, me)` returns intents. The start spot is a separate pure function, not a `Bot` method (`docs/architecture/ai/start-spot.md`).
- `perceive`, ghosts, explored cells, enemy groups, power, and emit. The danger map replaces the threat grid (`docs/architecture/ai/danger-map.md`).
- One brain for all difficulties. Only knob numbers differ.

## Cost

- The board is built once per think and shared by every layer.
- Slow layers run rarely. The commander runs every 2 seconds.
- Bots keep their seeded phase, so they think on different ticks.
- At most 40 intents go out per think. Hysteresis in goals and the allocator stops the whole army from changing orders at once.
- No layer searches. No HTN, GOAP or combat simulation. The research found no RTS bot that needed them at this scale.
