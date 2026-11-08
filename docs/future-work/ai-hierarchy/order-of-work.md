Not built. Part of the hierarchical bot proposal (`shape.md`).

# Order of work

Each step is one commit with its tests. The bot plays after every step. The game rules that give an edge, and whether the bot uses them, are in `mechanics.md`.

Built: bot-versus-bot grading, the start spot, the board and danger map, plans and the allocator, the commander with demand-driven production, the factory anchored behind the front, tank siege, engineers sieged at factories, and the map study with the hold spot. Each has a doc in `docs/architecture/ai/`.

## Next, in order

1. **Radar and sieged artillery.** Sieged guns reach 2200, more from high ground. Radar shows targets at that range. Then jammers to deny the same to the enemy.
2. **Map study, more uses.** Danger along real paths, not straight lines. Enemy reach that counts height. Lines across choke points, with fall-back and push along the chain of hold spots.
3. **Reclaim.** Scrap pays half its cost.
4. **Mines.**
5. **A stronger yardstick.** `legacy` now loses most games. Grade against a frozen copy of a recent bot as well.

## Findings

All scores: current against `legacy`, 200 matches on seeds 501-600, on the user's `unitStats.json` (factory cost 4500).

- Factory anchored behind the front, no field chasing: 103-97. The old field-chasing move scored 108-92. The move was hiding a field score tied to factory distance.
- Tanks siege on contact, idle tanks sieged at staging: 140-60. A siege rule with "outranged" and "enemy pulls back" checks scored 97-103.
- Engineers sieged at factories: 160-40.
- Hold spot from the map study: 164-36.
- Dropped, each measured alone: pool reinforces the main squad 91-109; retreat to the factory 136-64; artillery holds while it has a target 135-65; danger along the road in attack choice 47-153; three harvesters per field 96-104; field defense (earlier, seeds 301-400) 80-98.
- Against `frozen` (a copy of the bot at a376e95), seeds 501-600: guns parked sieged behind the hold spot with the radar truck at it 90-110 (legacy 146-54); one jammer sieged at the hold spot 93-107 (legacy 148-52). Both dropped.
- Pattern: every piece that holds units back to defend has lost. Pieces that add fighting power or tempo have won.
- With equal brains, the same seat wins both matches of a seed. A seat carries a start spot and a bot seed.

## Tests

- Each layer gets unit tests on plain data, with no sim running.
- Grade every behaviour change on 200 bot-versus-bot matches (100 seeds, each played twice with the brains swapped), on seeds it was not tuned on. 40 matches cannot tell a gain from luck.
- A change that should not change behaviour must replay the same matches exactly.
- You check the look of the play by hand.
