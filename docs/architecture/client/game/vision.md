Source: apps/client/src/game/vision.ts, apps/client/src/game/sightGrid.ts, apps/client/src/game/lineOfSight.ts, apps/client/src/game/radarSpot.ts, apps/client/src/game/visiblePoses.ts, packages/sim/src/mapSize.ts

# Vision: fog of war

Fog of war hides enemy units the local player does not know about. It is display only. Terrain is never hidden or dimmed.

## Not cheat-proof

Lockstep gives every client the whole world (`client/game/lockstep.md`). The fog only stops the client from drawing and picking hidden things. A changed client can show everything. The sim never reads vision, so fog cannot cause a desync.

## Three levels

`level(u)` gives one of three levels for each unit.

- `seen`: line of sight (LOS). Some own unit has the enemy inside its `sight` range, and no terrain rises above the straight line from the viewer's eye to the enemy's top. Eye = ground + `UNIT_STATS[kind].height`. Top = ground + the enemy's `height`. The enemy draws in full: model, bars, effects, picking, a minimap square at its true place.
- `radar`: not seen, but inside some own unit's radar range. Hills do not block radar. The enemy shows only as a dot at a rough place (below).
- `none`: the enemy is not shown anywhere.

Own units are always `seen`. Sight range is `UNIT_STATS[kind].sight`. Radar range is the sim's `radarRange(unit)`: `siegeRadar` when sieged, else `radar` (`sim/stats.md`). Vision reads radar only through that helper. Ground height is the sim's `heightAt`.

## Update

`update(world, me, time)` runs every frame from the frame loop. It stores `time` (seconds, for radar drift). It rebuilds only when the sim stepped, the world or the local player changed, or `revealAll` flipped. So the rebuild runs at the sim rate (10 Hz), not per frame.

1. `SightGrid.useTerrain`: cache the ground height of each cell centre. Only when the `Terrain` object changed.
2. Collect own units and their eye heights.
3. Mark the sight grid (below) for each own unit.
4. Classify each enemy: `seen`, `radar` or `none`.

All buffers are reused. A rebuild allocates nothing after warm-up.

## The sight grid (points)

`SightGrid` holds one byte per terrain cell: `terrain.cols - 1` by `terrain.rows - 1`, row-major `j * cols + i`. `useTerrain` reallocates the buffers when those counts differ, so the grid follows any map size. 1 means the player has LOS to a point `POINT_Z` (40) above the cell centre.

Method: for each viewer, cast one ray from its cell to every cell on the edge of its sight square. Walk the ray one cell at a time and keep the highest ground slope so far (`(ground - eye) / distance`). A cell is seen when the slope to its point is at least that highest slope. The ray stops at the sight radius or the map edge.

`sees(x, y)` reads this grid. Shells, particles and smoke use it.

## Unit LOS (per enemy)

Enemies are few next to cells, so each enemy gets exact tests. For each own unit in range, `clearLine` samples `heightAt` every half cell along the line from eye to top. The first clear line makes the enemy `seen`. Else any radar range makes it `radar`.

A scratch probe with 200 own units and 200 enemies measured about 1.2 to 1.4 ms per rebuild.

## Radar spot

`radarSpot(u, out)` writes where the dot of a radar contact is now: the true sim position plus `radarOffset(id, time)`, clamped to the map (`clampX`, `clampY`).

`radarOffset` (`radarSpot.ts`) is pure. Every 2.5 s it picks a new point in a disc of `RADAR_JITTER` (180) world units, from a hash of the unit id and the time bucket. The offset glides to the next point with a smoothstep. Each unit's clock has its own phase, so dots do not jump together. The dot drifts, so it never gives the exact spot.

## Queries (the one seam)

Every consumer goes through `Vision`. Do not write range or LOS tests anywhere else.

- `level(u)`: `seen`, `radar` or `none`.
- `shows(u)`: `level(u) === "seen"`. Draw it as a unit, let it pick.
- `sees(x, y)`: the point is in LOS (the sight grid).
- `showsAt(owner, x, y)`: true for own things, else `sees(x, y)`.
- `radarContacts()`: the enemies at level `radar`. A reused array, valid until the next rebuild.
- `radarSpot(u, out)`: the dot position.

## Reveal all

`revealAll` (default false) makes every unit `seen` and every point seen. It is the hook for a dead player or a spectator.

## Injection

`startClient` builds the one `Vision` and passes it down. The frame loop updates it and puts it in `Frame.vision`. `createActions` gets it for picking (`client/game/picking.md`). `Hud` gets it and hands it to `Minimap`. No module holds a shared instance.

## Consumers

| Consumer | Rule |
|---|---|
| `Renderer.prepare` | `keepVisible(poses, vision)` keeps only poses that `shows`, in id order. So units, contact shadows, unit shadows, rings, bars and order lines skip the rest. |
| `RadarPass` | One soft dot per radar contact (`client/render/billboards.md`). |
| `ProjectilesPass` | Own shells always; enemy shells by `showsAt` at the drawn position. |
| `EffectsPass`, `SmokePass.fill` | Particles and puffs only where `sees`. |
| `DecalMap.update` | Scorches burn in only where `sees` at impact. A scorch stays after the area goes dark. |
| `picking.ts` | Only units that `shows` can pick. Radar dots never pick. |
| `Minimap` | Seen units as squares, radar contacts as faint dots (`client/ui/minimap.md`). |

Resource fields and terrain are always drawn, on the ground and on the minimap.

## Invariants

- Vision reads the sim. It never writes it.
- Own units and own shells are always shown.
- Units are tested at their sim position, not the drawn pose. Picking does the same.
- Radar dots have no bars, no order lines, no picking.
