Source: apps/client/src/ui/unitPanel.ts, apps/client/src/ui/singleView.ts, apps/client/src/ui/multiView.ts, apps/client/src/ui/selectionModel.ts, apps/client/src/ui/unitReadouts.ts

# Unit panel

The centre console box (`#unit-panel`). The top area (124 px) shows the selection. The bottom band (68 px) shows the factory queue (`client/ui/queue.md`). With the 8 px gap they fill the 200 px inside the box.

## UnitPanel

`update(model)` hides the whole box when `model.hasSelection` is false. Otherwise it picks a state from `model.selection`:

- One unit: `SingleView`.
- Two or more: `MultiView`.

## SingleView

A 124 px headshot in a frame, then the kind name, a health bar with `hp / max`, the mode, the activity line (`#single-activity`, hidden when empty), and up to `MAX_READOUTS` (4) readouts. Each readout is a label and a value. The bar has class `high`, `mid` or `low` (`tone`).

## MultiView

A fixed grid of `MULTI_SLOTS` (27) tiles, 9 by 3, 38 px each. Each tile is a headshot with a thin health bar. A unit in a control group shows the group number top-left (`u-group`, `client/game/control-groups.md`). Unused tiles are hidden.

- Click: `actions.selectOnly(id)`.
- Shift-click: `actions.deselect(id)`.
- When more units are selected than fit, the last tile reads `+N` and does nothing on click.

## selectionModel.ts (pure)

`selectionView(world, selected, groupOf)` returns `{ count, single, cards, more }`. `groupOf(id)` gives a unit's control group, or 0.

- Units sort by the sim's `UNIT_KINDS` order (factory, harvester, engineer, radar, tank, artillery), then by id.
- `single`: a `UnitDetail` when exactly one unit is selected, else null. Its `activity` is `Guarding <kind>` when the head order is a `guard` on a unit that exists, else `""`.
- `cards`: up to `MULTI_SLOTS` `UnitCard`s, or `MULTI_SLOTS - 1` when `more` is above 0.
- `UnitCard`: `id`, `kind`, `hp` (rounded up), `maxHp`, `hpPct`, `tone` (`high` above 60 %, `mid` above 30 %, else `low`), `group` (0 = none).

## unitReadouts.ts (pure)

`unitReadouts(kind, mode)` reads the current mode's stats through the sim's `weaponOf`, `workRateOf` and `radarRange` (`sim/units.md`):

- Armed units: `Damage`, `Range` (siege values while sieged, `—` while deploying or packing), `Reload` in seconds.
- Harvester `Harvest` in cr/s, engineer `Repair` in hp/s, factory `Build` as `×rate`. 0 while deploying or packing.
- Kinds whose `siegeRadar` is above `radar` (the radar truck): `Radar`, the range now. The mobile value until fully sieged.
- Sieged with `siegeArmor` below 100: `Damage taken` as a percent.

## Recipe: add a readout

Add it in `unitReadouts.ts`. If a unit can now have more than `MAX_READOUTS`, raise it and check the 124 px height still fits.
