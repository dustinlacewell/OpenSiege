Source: packages/sim/src/stats.ts, packages/sim/src/statFields.ts, packages/sim/src/statsData.ts, packages/sim/data/unitStats.json, apps/client/devStatsPlugin.ts

# Stats and constants

`stats.ts` holds the constants and the `UnitStats` type. The per-unit numbers are not in code. They live in `packages/sim/data/unitStats.json`, one object per kind, and `stats.ts` loads them into `UNIT_STATS` at start-up.

## The data file

- `statFields.ts` describes every `UnitStats` field: label, section, unit, help, and its legal range or options. Its object order is the display order and the file order. The type forces an entry for each field.
- `statsData.ts` checks the file against that description (`parseUnitStats`) and writes it back (`serializeUnitStats`). It is pure.
- A bad file stops start-up with one line per error. Every peer loads the same file, so all must be built from the same copy. A mismatch shows as a desync.
- The Vite dev server's route `/__dev/unit-stats` (`devStatsPlugin.ts`, serve only, never in a build) reads and writes the file for the unit stat editor at `/units.html` (`client/dev/unit-editor.md`). It checks the body with `parseUnitStats` before it writes. A write reloads the client.
- Hand edits to the JSON are fine. Keep it valid.

## Constants

`TICK_MS` 100, `ANGLE_STEPS` 256, `START_CREDITS` 600, `PROJ_FP` 16, `GRAVITY` 24, `TERRAIN_MAX_HEIGHT` 900, `MAX_FIELDS` 64, `MAX_QUEUE` 30, `MAX_QUOTA` 20.

Map width, height and terrain cell size are not constants. The world carries them (`sim/map-spec.md`). `MAX_FIELDS` is the most resource fields a map may hold. It is also the size of the field array in the terrain shader.

Repair and guard: `MOBILE_REPAIR_REACH` 200, `GUARD_LEASH` 250, `GUARD_RETURN` 120, `GUARD_MARGIN` 200, `GUARD_RANGE` 700 (`sim/systems/guard.md`).

## Kind lists

- `UNIT_KINDS`: every kind, in `UNIT_STATS` row order (`Object.keys`). The client iterates it and sorts selected units by it. Row order is therefore the display order: factory, harvester, engineer, radar, jammer, tank, artillery. Never write a list of kind names by hand.
- `BUILDABLE`: the kinds with `buildable` set. Today that is every kind. The intent validator of a host and the HUD both read it.

## UnitStats

`UNIT_STATS[kind]` fields:

- Economy: `cost` (charged at enqueue), `buildTicks` (work needed), `buildable` (a factory may build it).
- Body: `maxHp`, `radius`, `height` (a shell hits when below ground + `height`), `speed`.
- Movement: `moveClass` (`light` or `heavy`) picks the nav grid (`sim/nav/nav-grid.md`). The factory is `heavy`; the rest are `light`.
- Siege: `siegeTicks` (deploy and pack time; 0 means no siege mode), `siegeArmor` (percent of damage taken), `sink` (how far the hull settles when sieged, world units; the client draws it and the barrel tip drops with it).
- Weapon: `weapon` (`none`, `direct`, `ballistic`, `mine`), `damage`, `range`, `reload`, `shotSpeed`, `splash`, `dig`, `maxPitch`, `minRange`, `gunX`, `gunZ`, `gunLength`, `gunRest`. `damage` 0 means unarmed. `maxPitch` is the steepest gun elevation of a `direct` weapon, in whole degrees (0 = flat shot only, editor cap 60). `minRange` is the nearest flat distance the unit picks a target at, mobile or sieged (0 = none). `gunX`, `gunZ`, `gunLength` are the barrel in turret space, world units: breech forward along the aim, breech height above the ground, and length. `gunRest` is the barrel elevation as modelled, whole degrees. The sim starts shells at the barrel tip (`sim/systems/projectiles.md`); `gunLength` 0 fires from the centre. The client should draw its barrels from these numbers.
- Siege weapon: `siegeDamage`, `siegeRange`.
- Work: `workRate`, `siegeWorkRate`, `workRange`. Factory: build progress per tick. Harvester: credits per tick. Engineer: hp per tick, and `workRange` while sieged.
- Vision: `sight` (line of sight, hills block it), `radar` (rough dots, hills do not block it) and `siegeRadar` (radar while sieged), world units. `detection.ts` reads them to decide what a team can target, `siegeRadar` through `radarRange` (`sim/detection.md`, `sim/units.md`). The client fog of war reads them too (`client/game/vision.md`). A kind with no siege bonus sets `siegeRadar` equal to `radar`. `jam` and `siegeJam` (jam radius moving / sieged, read through `jamRange`): enemy radar cannot detect own-team units within it; sight still can. 0 for every kind but the jammer.

Every row in the file holds every field. There are no defaults.

## Kinds

| Kind | Role | Radar (mobile / sieged) |
|---|---|---|
| factory | builds units | 2600 / 2600 |
| harvester | gathers credits | 1400 / 1400 |
| engineer | repairs | 1800 / 1800 |
| radar | radar truck: cost 250, 120 hp, speed 26, no weapon, sight 700, siege 20 ticks, no siege armour | 3500 / 5500 |
| jammer | radar truck body; jam 900 mobile, 1800 sieged | 1400 / 1400 |
| tank | direct fire | 1600 / 1600 |
| artillery | ballistic fire | 1800 / 1800 |

## Recipe: add a unit kind

1. `types.ts`: add the name to `UnitKind`.
2. `statsData.ts`: add the name to `KIND_SET`. `data/unitStats.json`: add a row with every field. The row's place sets its place in `UNIT_KINDS`. Set `buildable: false` if no factory builds it.
3. `render/meshes.ts`: add a model builder to `UNIT_MESHES` (`client/render/unit-meshes.md`).
4. `game/buildGrid.ts`: put a buildable kind in a free slot of `BUILD_PAGES`.
5. The compiler flags every other `Record<UnitKind, ...>` (today: `DEATH_SIZE` in `audio/worldEvents.ts`). Add the entry.

Everything else follows the stats: the draw list, the headshot, the selection order, readouts, shell looks and range circles. Optional extras: a barrel in `game/muzzle.ts` `BARRELS`, a `WORK` entry in `ui/unitReadouts.ts`, and new rules in the system that owns them (`sim/systems/`). A host's intent validator needs nothing: it reads `BUILDABLE`.
