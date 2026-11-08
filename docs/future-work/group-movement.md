Not built. Research notes for a future change.

# Group movement: what is still unbuilt

Built and documented elsewhere: per-unit formation spots (`docs/architecture/sim/formation.md`), stop-on-contact arrival (`docs/architecture/sim/systems/arrival.md`), soft push (`docs/architecture/sim/systems/separation.md`), queued waypoints (`docs/architecture/sim/orders.md`).

Constraints: lockstep, integer math only, 10 ticks/s, hundreds to low thousands of units, maps up to 16000x16000, hills only.

Source quality is marked. "Code" means engine source I read. "Forum" means player or dev posts. "Blocked" means I could not open the page. Treat forum claims as leads, not facts.

## Recommendation (ranked)

1. **Group speed matching (optional order).** A group order moves at the speed of the slowest unit in the group.
   - Why first: very cheap. SupCom and Spring ship it. It keeps mixed groups together.
2. **Built: a path per order, planned with A*.** See `sim/nav/pathfinding.md`.
   - Obstacles came with cliffs and rocks. Each order plans once and the unit follows the waypoints.
   - Tiled flow fields, HPA* and navmesh stay unbuilt. Add only if profiling says A* is too slow.
3. **Do not build ORCA/RVO.** No open-source fixed-point ORCA exists that I could find. The one shipping deterministic velocity-obstacle system (Photon Quantum) documents jitter. Our unit counts and open map do not need it.

Own judgment, not from a source: at 10 ticks/s, units that steer by velocity-obstacle search will visibly jitter. Soft push hides this better.

## Arrival ideas not built

From Spring/Recoil [GroundMoveType.cpp](https://raw.githubusercontent.com/beyond-all-reason/RecoilEngine/master/rts/Sim/MoveTypes/GroundMoveType.cpp) (code):

- **Goal radius grows when stuck.** For move commands the goal radius is multiplied by (idle slow-updates + 1). A stalled unit accepts a bigger circle around the goal. `MAX_IDLING_SLOWUPDATES` is 16.
- **Waypoint contagion.** If a unit touches another unit that stands on its next waypoint, it skips to the next waypoint. Our waypoint rule is a radius test only.

## Path planning for groups

Our map is open hills. Straight lines work today. Read this section when obstacles arrive.

| Method | Shipped in | Cost | Pays off when |
|---|---|---|---|
| Flow field (tiled) | Supreme Commander 2, Planetary Annihilation, AoE4 (with HPA*) | One field per destination, shared by all units | Many units, one goal, changing obstacles |
| HPA* / hierarchical | AoE4, OpenRA, 0 A.D. (reachability only) | Per-unit query on a coarse graph | Large maps, many different goals |
| Navmesh + funnel | Recast/Detour, Photon Quantum | Per-unit A* plus string-pull | Complex 3D geometry |
| Continuum crowds | No shipped RTS found | Rebuild grids every tick | Research and tunnels |

Facts and sources:

- **SupCom 2 and PA flow fields.** Created for SupCom 2. Sector-level path first, then local fields. Tiled to save memory. Line-of-sight check near the goal gives straight paths. Author: Elijah Emerson, "Crowd Pathfinding and Steering Using Flow Field Tiles", Game AI Pro 360, chapter 7 ([listing](https://www.routledge.com/products/9780367151133)). I did not get the chapter text. Secondhand: [howtorts](https://howtorts.github.io/2014/01/04/basic-flow-fields.html), [gamedev.net](https://gamedev.net/forums/topic/701267-flow-field-architecture-advice/5401826/), [PA forum](https://forums.planetaryannihilation.com/posts/705714).
- **Open-source reference.** [bevy_flowfield_tiles_plugin](https://docs.rs/crate/bevy_flowfield_tiles_plugin/latest/source/README.md) follows the chapter. Sectors are 10x10 cells. Costs are 8-bit (255 = wall). It has portals, an integration pass with line-of-sight flags, and 8-direction flow cells. It reports 3 ms for an open flow field and 84 ms for a route query on an i7 (floating hardware, not our target). The structure is all small integers, so it ports to our sim.
- **AoE4.** Flow fields plus hierarchical A* plus steering. Abstract only: [GDC 2022](https://gdcvault.com/play/1027659/Pathing-in-Age-of-Empires).
- **OpenRA.** Added a hierarchical pathfinder in 2023: a coarse map gives an abstract route, then a detailed search. Immovable actors are baked into the coarse map. Cost is extra load time and small ongoing overhead. See [PR 20189](https://github.com/OpenRA/OpenRA/pull/20189).
- **0 A.D.** Two levels. Long range: grid A* with JPS on a navcell grid, units ignored. Short range: vector pathfinder around nearby units and obstacles. Positions are fixed-point with a 16-bit fraction. [pathfinder.tex](https://raw.githubusercontent.com/0ad/0ad/9ca70aebd8ea975e968742304d827cf9d5d31e30/docs/pathfinder.tex). The doc is from 2012 and the repo was archived in 2024.
- **Continuum crowds.** Per-tick density and velocity grids plus a fill per goal. Too heavy. The author of howtorts doubts SupCom 2 used it. Lanes form in tunnels but not in open space. [howtorts](https://howtorts.github.io/2014/01/09/continuum-crowds.html).

What we built when obstacles arrived: A* per unit at order time on the nav grid, string pulling, and a pure-pursuit follower (`sim/nav/pathfinding.md`). The flow field plan here was tried first and dropped.

## Pre-contact steering

Soft push is built. These methods would add steering before units touch.

| Method | Deterministic fixed-point? | Notes |
|---|---|---|
| Boids separation | Yes, easy | Only needs distance and a push vector. |
| ORCA / RVO2 | Hard | Linear programs and square roots. Float library. No fixed-point port found. |
| HRVO (Photon Quantum) | Yes, shipped | Commercial, fixed-point. Docs warn of jitter. |
| Social forces | Possible | Many tuning knobs. No RTS ship found. |

- **Spring/Recoil** uses float math and relies on one binary on every machine. It has pre-contact steering (`GetObstacleAvoidanceDir`, run every N frames, staggered by unit id). It skips avoidance for idle allies.
- **Photon Quantum** is a deterministic engine with fixed-point math. Its navmesh agents use HRVO. Docs say direction "can be unstable" with fixed-point and cause jitter. Cost scales with avoidance range, candidate count and quality. See [avoidance](https://doc.photonengine.com/quantum/v3/manual/navigation/avoidance) and [overview](https://doc.photonengine.com/quantum/v3/manual/navigation/overview).
- **ORCA.** Original: [UNC ORCA page](https://gamma.cs.unc.edu/ORCA/) and the [RVO2 library](https://github.com/snape/RVO2). Each agent solves a small linear program. Claim: thousands of agents in a few ms (float, C++). My search found C#, Java and Python ports, all float. I found no fixed-point ORCA. Fixed-point libraries exist ([FixedMathSharp](https://github.com/mrdav30/FixedMathSharp-Unity), [Klotho](https://github.com/xpTURN/Klotho)) but I did not confirm any avoidance code in them. If we ever port ORCA: fixed iteration order, integer sqrt, no OpenMP-style threading, and expect jitter.
- **Determinism rules for any of these.** Integer math only. Process units in id order. Use a spatial hash with a fixed cell scan order. Cap push per tick. Use a lookup table for any trig.

Our plan: add pre-contact steering only if units visibly clump.

## Speed matching and formation movement

- **SupCom.** Formation move uses the slowest unit's speed once in shape. Source: [FAForever wiki quote via forum](https://forum.faforever.xyz/post/1130). In SupCom 2, formation move gave units extra speed to reach slots; players abused it.
- **Spring / BAR.** A "move at the slowest speed of the group" order exists (ctrl+alt). There was a bug where the speed stayed stuck on the unit. Reported as fixed in Spring 86.0 (search summary of a [Spring bug report](https://springrts.com/mantis/view.php?id=875); not confirmed by me). GroundMoveType.cpp has no group speed logic. The speed is set by the command layer. Per-unit speed also depends on terrain slope.
- **Company of Heroes.** Squads, not armies. A formation is a set of offsets from the squad leader. Each follower's speed is adjusted from its offset to the leader, so it catches up or waits. Source: Chris Jurney, "Company of Heroes Squad Formations Explained", AI Game Programming Wisdom 4. I read only a secondhand summary; the [PDF copy](https://forum.arongranberg.com/uploads/short-url/rWod3K2KhNWcOEdjewnsLXQKU6A.pdf) would not extract.
- **0 A.D.** Proposals to keep a clump together without formations: give each unit an expected direction, slide along allies in parallel, move units in order of path length. Not confirmed as merged. [Forum thread](https://wildfiregames.com/forum/topic/20723-improving-pathfinding-for-large-armies).
- **SC2** keeps clumps tight with no speed matching, per forum.

Our plan: add one order flag, "group speed". The group cap is the minimum of the unit speeds, computed once when the order is issued. Store it in the order, not per tick. Do not do per-follower catch-up yet. Hills slow units already (`slope.ts`), so the cap must use flat-ground speed or the slope-scaled speed on purpose.

## Newer (2020-2026) and what ships

- **GDC 2022, AoE4**: [Pathing in Age of Empires IV](https://gdcvault.com/play/1027659/Pathing-in-Age-of-Empires). Flow fields, hierarchical A*, steering. Slides locked. I found no later GDC talk on RTS crowd movement.
- **OpenRA 2023**: hierarchical pathfinder, see Path planning.
- **Beyond All Reason / Recoil**: engine work in 2025 targets thousands of units ([Notebookcheck, May 2025](https://www.notebookcheck.net/Open-source-RTS-Beyond-All-Reason-showcases-large-scale-engine-update-as-player-interest-climbs.1014152.0.html)); the article names no movement details. Recoil adds multi-threaded pathfinding ([BAR docs](https://beyond-all-reason.github.io/spring/about)). The QTPFS changelog is [105-2314](https://beyond-all-reason.github.io/spring/changelogs/changelog-105-2314) (I saw a search summary: fewer stuck units, fewer cut corners; the page itself returned 404 to me).
- **Stormgate (Frost Giant)**: deterministic custom engine "Snowplay", lead pathfinding architect from SC2. Has a devblog, "Pathing and Steering Updates" ([link](https://playstormgate.com/news/pathing-and-steering-updates)). It returned 503. Worth a re-read.
- **Photon Quantum**: shipping fixed-point HRVO. See Pre-contact steering.
- **Flow field tiles in open source**: Bevy plugin above.
- **Gaps.** No paper from 2020-2026 gave a fixed-point crowd method for lockstep that I could find. Page blocks (Anubis) hid several 0 A.D. sources.

## Open questions before building

- Should "group speed" be default or opt-in (SupCom: opt-in)?
- Should a group order keep its speed cap if a slow unit dies mid-move?
