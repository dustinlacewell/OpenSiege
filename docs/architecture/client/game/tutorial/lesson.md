Source: apps/client/src/game/tutorial/lesson.ts, apps/client/src/game/tutorial/checks.ts, apps/client/src/game/tutorial/world.ts, apps/client/test/tutorialLesson.test.ts

# Tutorial lesson

`TUTORIAL` is the one lesson. It plays on `maps/tutorial/tutorial.json`. It has 36 steps: 30 tasks and 6 notes. Each step asks for one small action. Selecting a unit is its own step, before the order.

## world.ts

`tutorialWorld()` is pure. It returns `{ world, you, enemy }`, with `you` = 1 and `enemy` = 2.

- The map file comes in as a JSON import (`with { type: "json" }`). This works under Vite and under `tsx`. `parseMapSpec` checks it. A bad file throws.
- One sim `step` applies two `join` intents. Player 1 "You" joins at (1200, 2000), team 0. Player 2 "Enemy" joins at (6000, 2800), team 1.
- Then both starting harvesters go. The player starts with only the factory.
- `spawnUnit` puts the enemy's harvester on its field at (5200, 3200), and three enemy tanks on its base (`ENEMY_TANKS`), out of the player's sight.

## Zones

- `field`: (2600, 2000), radius 500. It is the map's crystal field.
- `pass`: (3650, 2150), radius 400. Flat, clear land between the hill (north) and the trees at (3600, 3300) (south). Rocks sit at (3184, 2577) and (4147, 2414), just outside it.
- `hill`: (3900, 1100), radius 450. It is the flat hill top, height 520. The ramp comes up from the west.
- `lookout`: (4100, 1300), radius 120, inside `hill`. A sieged radar here reaches the enemy factory. A sieged radar reaches 2600; the far edge of `lookout` is about 2540 from the factory. The hill centre is 2702, out of reach.

## Policies

- `allow(select, ...rules)`: only own units of the `select` kinds are selectable, and only `rules` pass. Each task selects only the units it is about and allows only what it teaches.
- The factory is never commandable before the last step. A move, attack-move, guard or stop with the factory selected leaves it out.
- Before the last step, no move or attack-move may have its target or a path point within 1500 of the enemy base, and no attack may name a unit there. Rally is not allowed. So the match cannot end before the lesson does.

## Step builders

- `select(id, prompt, kind, skip?)`: a frozen task that allows no intent and only `kind` to be selected. It ends when an own `kind` is selected, so the click alone ends it, in stopped time. `skip(world)` ends it anyway. An already-selected unit ends it at once.
- `buildTank(id, prompt, n)`: build tanks at the factory. Done: `n` own tanks exist.

## Steps

Each line gives the id, what the step asks, and when it is done. "Frozen" = a `freeze` task: time stops until the player sends its first intent. "Select" = a `select` step.

Camera:

1. `pan-camera` (frozen): middle-drag or the arrow keys. It allows no intent, so time stays stopped for the whole step. Done: the camera's ground point moved 600 or more (`panned`).
2. `turn-camera` (frozen): Ctrl and a middle-drag. Done: the camera turned 0.5 radians or more, the short way round (`turned`).

Factory and harvester:

3. `select-factory` (select).
4. `build-harvester`. Done: a harvester job is 30% built (`buildDone`), or a harvester exists. So the siege note stops time partway through the wait.
5. `about-siege` (note): this is slow; siege to build four times faster; sieged units can't move, but every unit gets a bonus.
6. `siege-factory` (frozen). Warns that unsieging takes a few seconds. Done: the factory is deploying or sieged.
7. `harvester-ready`: wait. Nothing is selectable. Done: an own harvester exists.
8. `about-harvester` (note): harvesters mine crystal; crystal is credits; credits pay for units.
9. `select-harvester` (select).
10. `harvester-to-field` (frozen): right-click the field. Done: an own harvester is in `field` with no move order left (`arrived`). So it has stopped where the move put it, not at the field's edge.
11. `siege-harvester` (frozen): siege mode makes it mine faster. Done: an own harvester is sieged on a field.

Tanks and the engineer:

12. `select-factory-for-tank` (select).
13. `first-tank`. Done: 1 own tank exists.
14. `build-engineer`. Done: an own engineer exists.
15. `about-engineers` (note): no gun; they repair, and speed up a factory they stand next to.
16. `second-tank`: the engineer speeds it up a little. A mobile engineer adds 0.25 progress per tick. Done: 2 own tanks exist.
17. `select-engineer` (select).
18. `siege-engineer` (frozen). Done: an own sieged engineer has an own factory within its work range (600). Sieged, it adds 2 progress per tick.
19. `select-factory-again` (select).
20. `third-tank`: this one comes out much faster. Done: 3 own tanks exist.
21. `select-engineer-to-guard` (select).
22. `guard-tank` (frozen): press Guard, then click a tank. A sieged guard packs up to follow. Done: an own engineer has a guard order on an own tank.

The pass:

23. `select-tanks` (frozen): double-click a tank to select every tank on screen. Done: 3 own tanks are selected.
24. `tanks-to-pass` (frozen): explains right-drag and asks for a line across the pass. `focus.gesture` acts the drag out. Once a tank has a move order, the gesture goes and the camera follows all own tanks (`onTheMove`). Done: a drag move (a path of 2 or more points) that names an own tank was sent in this step, and 3 own tanks are in `pass` and `arrived`. So all three have stopped in the line before the siege step stops time.
25. `siege-tanks` (frozen). Done: 3 own sieged tanks are in `pass`.
26. `about-sieged-tanks` (note): sieged tanks hit harder, shoot farther and take less damage.
27. `hold-pass`. Its `enemy` script sends the three enemy tanks to `PASS_APPROACH` (4550, 2100), out of the player's range, then queues an attack-move to the pass. The first leg keeps them north of the rock at (4147, 2414). Behind that rock neither side can hit the other, and the fight stalls. The focus and the camera follow are the enemy tanks the player detects. Before they are seen, the camera looks at the pass. Done: no enemy tank is alive.

Scrap:

28. `select-engineer-for-scrap` (select): wrecks leave scrap; engineers turn it into credits. Skipped when no scrap is left within 1500 of the pass centre (`scrapNear`).
29. `reclaim-scrap` (frozen): an area reclaim. Allows only `reclaim`. `focus.gesture` is `reclaimDrag` over the scrap near the pass: a circle that presses on the wreck nearest the scraps' middle (a drag must start on scrap) and reaches 60 past the farthest one. It follows the scrap as it goes. While an own engineer has a reclaim order, there is no gesture. Done: no scrap is left near the pass.

Radar:

30. `select-factory-for-radar` (select).
31. `build-radar`. Done: an own radar exists.
32. `select-radar` (select).
33. `radar-to-hill` (frozen): right-click the ring on the hill top. The camera follows the radar while it moves. Done: an own radar is in `lookout` and `arrived`.
34. `siege-radar` (frozen). Done: an own sieged radar is in `lookout`, and the player detects the enemy factory.
35. `about-radar` (note): the radar spots the enemy factory and harvester.
36. `destroy-factory`: build an army and destroy the enemy factory. Allowed: `FREE_POLICY`. Done: no other player has a factory. The match then ends, and the tutorial shows its thank-you card (`client/match/local-match.md`).

## The playthrough test

`tutorialLesson.test.ts` plays the whole lesson with the real sim and no DOM. It runs each intent through `admit` and sends what comes back. A dropped intent fails, so each step allows its own intended path. Each task has a tick budget; a select step has none. A step that stalls fails with its id. A note is acknowledged at once and takes no tick. A frozen task takes no tick until its script sends. If its script only selects or moves the camera, the step must end on that alone. The test keeps its own camera pose, starting at the player's base, and a script moves it with `look`. The `tutorialEnemy` script runs on every tick that time runs, as the tutorial match runs it.

It also proves:

- The camera steps come first, stop time, and allow no intent and no selection.
- The second tank builds faster than the first, and the third faster than the second.
- At least one of the three sieged tanks lives through the pass fight.
- The pass fight leaves scrap, and the area reclaim the gesture shows takes every wreck. `reclaimDrag` presses on a wreck and holds them all.
- At the radar note the player detects the enemy factory and harvester.
- The camera follow list fills on `tanks-to-pass`, `hold-pass` and `radar-to-hill`, and on no other step.
- The starting units are as listed above, and the player sees no enemy tank at the start.
- Before the last step every task blocks a move, attack-move, path, attack and rally aimed at the enemy base.
- `field` is a map field, `hill` and `lookout` are on the hill top, and `pass` is flat (height spread of 30 or less) with no feature in it.
