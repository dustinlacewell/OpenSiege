Source: apps/client/src/game/palette.ts, apps/client/src/render/teamColors.ts, packages/sim/src/intents.ts

# Player colours

`Player.color` is an index. The sim sets it to `id % 12` on join (`COLORS = 12` in `intents.ts`). The client maps the index to a colour.

## palette.ts

- Twelve hex colours in `HEX`.
- `colorCss(color)`: the CSS string. The leaderboard and the minimap use it.
- `colorRgb(color)`: three floats in 0..1. The renderer uses it.
- Both wrap the index with a positive modulo, so any integer is safe.

## render/teamColors.ts

`TeamColors` maps an owner id to an rgb for the current frame.

- `use(players)` sets the player list for this frame.
- `of(owner)`: the player's rgb, or neutral grey `[0.6, 0.6, 0.6]` if the owner is not found.
- It looks the player up with `playerById`, so `players` must be sorted by id.

Units use the colour on panels and as a faint paint tint (`client/render/units.md`).

## Change the palette

Edit `HEX`. Keep it at 12 entries to match `COLORS` in the sim. The client wraps any index, so a size mismatch repeats colours. It does not fail.
