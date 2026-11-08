Source: packages/ai/src/plan/front.ts

# Front

The primary front is one point: where the bot's war is now. The base planner anchors the factory behind it (`base.md`). Staging leans toward it.

`frontOf` takes the first of these that exists:

1. The target of the largest attacking squad. Only squads in state `attack` that are not scouting count. Largest means most members.
2. The known enemy group nearest the site. Groups are built from all known enemies, factories included.

With neither, there is no front.
