Source: packages/ai/src/start/pickStartSpot.ts, packages/ai/src/start/botStartSpot.ts, packages/ai/src/knobs.ts, packages/sim/src/spawn.ts

# Start spot

A bot picks its factory spot before the round. `pickStartSpot(spec, taken, me, knobs, seed)` is pure. It reads the map spec, the spots taken so far with their teams, the bot's team, the start knobs and a seed.

`botStartSpot(spec, taken, me, difficulty, seed)` reads the knobs for a difficulty and calls it. The match host calls it for each bot when the choose-your-start phase opens, against the earlier bots only. It calls it again for a bot that has a human spot within 2500 of it (`client/game/skirmish/world.md`).

## Candidates

- Each field centre.
- 8 points on a ring around each field, at the field radius plus 300.
- A candidate is dropped when it is outside the spawn clamp (`spawnEdge`), in water (`inWater`), or not a good spawn spot. `goodSpawnSpot` in `packages/sim/src/spawn.ts` is the test the sim's own spawn picker likes best: no feature near, and flat ground.

## Minimum gap

No pick comes near a taken spot, ally or enemy. A candidate is dropped when it is closer than the minimum gap to any taken spot. The gap starts at `max(2500, diagonal / 6)` (`minGap`). When no candidate is left, the gap halves and the filter runs again, down to 600 (`MIN_GAP_FLOOR`). When none is left at 600, the fallback picks the spot.

## Fallback

The fallback scans a 16 × 16 grid of points over the spawn clamp, corners included. It keeps the points that pass the same test as the candidates. It takes the point farthest from every taken spot. On a tie, it takes the point nearest the map centre. With no usable point, the spot is the map centre.

## Score

- Wealth: the sum over fields of `amount × max(0, 1 − distance / 3000)`.
- Enemy gap: the distance to the nearest taken spot of another team. With none, the map diagonal.
- Score: `wealthWeight × wealth / maxWealth + (1 − wealthWeight) × gap / diagonal`. `maxWealth` is the best wealth among the candidates.

The bot takes the best `topN` candidates and picks one with its seeded roll (`rng.ts`). The same seed gives the same spot.

## Knobs

| Knob | easy | normal | hard |
|---|---|---|---|
| `wealthWeight` | 0.5 | 0.6 | 0.6 |
| `topN` | 6 | 3 | 1 |

## Tests

`packages/ai/test/startSpot.test.ts`.
