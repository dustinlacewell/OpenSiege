Source: packages/sim/src/systems/harvest.ts, packages/sim/src/systems/fieldRegen.ts, packages/sim/src/world.ts, packages/sim/src/mapSize.ts, packages/sim/src/stats.ts, packages/sim/src/types.ts

# Economy

Credits come from resource fields. Harvesters carry them straight to the owner. There is no hauling.

## Fields

- 40 fields on the default map, placed at map generation (`sim/world-creation.md`). The count scales with map area and never exceeds `MAX_FIELDS` (64). A field lies wholly inside the map.
- `ResourceField { id, x, y, radius, amount }`. Radius 400 to 700. `amount` starts at `FIELD_AMOUNT` (5000).

## harvest(world)

For each `harvester` in id order:

1. `rate = workRateOf(unit)`: 1 mobile, 5 sieged, 0 in transition. Stop if 0.
2. Find the first field in list order with `amount > 0` and the unit inside `radius` (`fieldUnder`). `index.ts` exports it for the client's idle-harvester key (`client/game/commands.md`).
3. Find the owner in `players`. Stop if there is none.
4. `take = min(rate, field.amount)`. Subtract from the field. Add to the owner's `credits`.

A harvester that sits in a field earns every tick. It does not need to move.

## fieldRegen(world)

When `world.tick % 10 === 0`, every field below `FIELD_AMOUNT` gains 1. It runs before `tick++`.

## Spending

Credits are spent by the `build` intent (`sim/systems/production.md`).
## Client reads

- `ui/model.ts` shows the player's `credits`.
- `render/terrain.ts` sends field position, radius and `amount / FIELD_AMOUNT` to the terrain shader. The ground glows by remaining amount.
- `ui/minimap.ts` draws fields as discs.
- `render/crystalShader.ts` allows `MAX_FIELDS` (64) fields. The sim never makes more (`sim/map-spec.md`).
