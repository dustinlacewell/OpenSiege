Source: apps/client/src/input/actions.ts, apps/client/src/input/actions/, apps/client/src/input/groupKeys.ts, apps/client/src/input/input.ts, apps/client/src/game/curve.ts, apps/client/src/game/areaReclaim.ts

# Actions

`Actions` is the one list of things a player can do. Mouse, keyboard, HUD buttons and the minimap all call it. It turns gestures into selection changes, camera moves and intents.

## Shape

`Actions` is one interface made of groups. Each group has its own file in `input/actions/`. Callers keep one `Actions` object and do not see the groups.

| File | Interface | Methods |
|---|---|---|
| `select.ts` | `SelectActions` | `clickSelect`, `kindSelect`, `boxSelect`, `selectAll`, `selectIdleBuilders`, `selectIdleHarvesters`, `selectOnly`, `deselect` |
| `command.ts` | `CommandActions` | `command`, `curveTo`, `commandCurve`, `areaStart`, `areaTo`, `commandArea`, `cancelDrag`, `dragCancels`, `siege`, `stop` |
| `build.ts` | `BuildActions` | `build`, `buildSlot`, `cancelJob`, `showBuildPage`, `adjustQuota` |
| `target.ts` | `TargetActions` | `enterTarget`, `targetMode`, `hoverTarget`, `targetAt`, `cancel` |
| `camera.ts` | `CameraActions` | `jumpTo`, `zoom`. Also exports `goHome`. |
| `guide.ts` | `GuideActions` | `acknowledge` |
| `hotkey.ts` | `HotkeyActions` | `hotkey` |

`context.ts` holds `ActionContext`: the injected deps and the helpers the groups share (below).

## Interface

```
clickSelect(sx, sy, additive)
kindSelect(sx, sy, additive, global) // own units of the clicked kind: on screen, or the whole map when global
boxSelect(sx0, sy0, sx1, sy1, additive)
selectAll()                        // every own unit
selectIdleBuilders(additive)       // idle engineers and factories with an empty queue
selectIdleHarvesters(additive)     // idle harvesters not at work in a field
selectOnly(id)                     // unit panel tile click
deselect(id)                       // unit panel tile Shift-click
command(sx, sy, mods, rally)       // right-click. mods = { force, queue }
curveTo(sx, sy)                    // right-drag: add a ground sample to the curve move
commandCurve(mods)                 // right-drag release: send the curve move
areaStart(sx, sy)                  // right-drag start: true when it is an area reclaim
areaTo(sx, sy)                     // area reclaim drag: the radius follows the cursor
commandArea(mods)                  // area reclaim release: send the reclaim chain
cancelDrag()                       // Esc or blur: drop the right drag, no order
dragCancels()                      // the count of drag cancels, read by the pointer
siege(queue)
stop()
build(kind, batch)                 // batch: up to 5 per factory
buildSlot(index, batch)            // the kind in that slot of the shown palette page
cancelJob(factory, jobs, many)     // queue tile right-click; jobs = the tile's job ids; many = Shift
showBuildPage(page)                // build palette page; out of range is ignored
adjustQuota(kind, delta)           // palette tile Ctrl-click (+1) and Ctrl-right-click (-1)
enterTarget(kind)                  // "guard" | "attackMove", only with own units selected
targetMode()                       // the kind, or null
hoverTarget(at)                    // every frame: the unit a guard click would pick
targetAt(sx, sy, mods)             // target-mode left click
cancel()                           // leave the target mode
jumpTo(wx, wy)                     // minimap
zoom(sx, sy, factor)
acknowledge()                      // Continue on a tutorial note: the guide panel button and Enter
hotkey(key, shift, at)             // at = key time in ms
```

Coordinates `sx, sy` are CSS pixels on the canvas.

## createActions(session, cam, vision, send, sendSpot, onIdleEscape, simpleGroups, guide)

All dependencies are injected: the `Session`, the `Camera`, the `Vision` (which enemies can be picked, `client/game/vision.md`), and `send(intent)`. The last one, `guide`, is optional and defaults to `NO_GUIDE`. `createActions` builds one `ActionContext`, makes each group from it, and spreads them into one object. `hotkeyActions` gets the other groups as its target.

### The guide gate

The `Guide` (`game/tutorial/guide.ts`, `client/game/tutorial/core.md`) is the only tutorial seam in input. `NO_GUIDE` allows everything. The groups do not check it. The gates sit in `context.ts`, plus one in `enterTarget`:

- `send(intent)`: sends what `guide.admit(intent)` returns, and nothing for null. The admitted intent can have fewer units than the one asked for: a move with the factory selected moves the rest. After a send, it calls `guide.noteSent` with the intent actually sent. `emit` goes through `send`.
- `select(hit, additive)`: while `guide.paused()`, nothing changes. Else only the ids in `guide.selectable(hit)` join the selection. When `hit` has ids but the guide allows none, the selection does not change. A click on a blocked unit keeps the selection. An empty `hit` (a click on empty ground) still clears it.
- `unselect(id)`: removes. Only a paused guide stops it.
- `enterTarget(kind)`: "guard" needs `guide.mayIssue("guard")`. "attackMove" needs `guide.mayIssue("move")`. When blocked, the mode does not change.

Camera actions are never gated.

Only the command group holds state of its own: the count of drag cancels. The curve being drawn lives in `session.curve`. The area reclaim being drawn lives in `session.area`. The target mode lives in `session.targetMode` and `session.guardHover`. Control groups live in `session.groups`.

### ActionContext

- `guide`: the injected `Guide`.
- `send(intent)`: the gated send (above).
- `emit(intent)`: `send`, or nothing for `null`.
- `pickAt(sx, sy, accept)`: `unitAtScreen` with `PICK_PX` = 6 pixels of slack.
- `groundPoint(sx, sy)`: `groundAt` into one scratch vector, or `null`. Read it before the next call.
- `select(hit, additive)`: `session.select(combine(selected, guide.selectable(hit), additive))`. It returns first while the guide is paused, or when `hit` is not empty and the guide allows none of it.
- `unselect(id)`: `session.select` without that id, unless the guide is paused.
- `own(u)`, `enemy(u)`: by `session.me`.

### Groups

- Selection: only own units can be selected. `selectAll` takes `ownUnits`. A global `kindSelect` takes `ownOfKind` (`game/selection.ts`). `selectIdleBuilders` and `selectIdleHarvesters` take `idleBuilders` and `idleHarvesters` (`game/idle.ts`, `client/game/commands.md`). `selectOnly` calls `select([id], false)`. `deselect` calls `unselect(id)`.
- `command`: finds the ground point. If `rally` (Ctrl held) and the selection has own factories, send `rally`. Else, if no enemy is under the cursor and the ground point is on scrap (`scrapAt`, 8 world units of slack), the selected own engineers get `reclaim` and the other selected units get a plain `commandAt` move to the point. Else `commandAt` with the enemy unit under the cursor (if any) and `mods`. `Pointer` sets `queue` from Shift and `force` from Alt.
- `curveTo`: with a selection, finds the ground point and sets `session.curve = addSample(curve, x, y, units, map)` (`game/curve.ts`). A miss, an off-map point (outside `0..map.width` and `0..map.height`), or a point closer than `MIN_SAMPLE` (40 world units) to the last one adds nothing. `addSample` resamples the stroke to at most `MAX_PATH_POINTS` integer points, ends kept, and computes the preview spots with the sim's `spreadAlong` for the selected count.
- `commandCurve(mods)`: clears `session.curve` and sends `commands.pathMove` with the curve's path, to all selected units, as a click move does. A path under 2 points sends a plain move to its one point.
- `areaStart(sx, sy)`: called once, when a right drag starts. With an own engineer selected and the press point on scrap (`scrapAt`, 8 world units of slack), it sets `session.area` and returns true. The circle centre is the press point, not the wreck centre. Else it returns false, and the drag is a curve move.
- `areaTo(sx, sy)`: sets the circle radius to the ground distance from the centre to the cursor.
- `commandArea(mods)`: clears `session.area` and sends `commands.areaReclaim`. A radius under `MIN_AREA_RADIUS` (16 world units) sends `commands.reclaim` of the press wreck only. Only the engineers get orders.
- `cancelDrag()`: clears `session.curve` and `session.area` and adds 1 to the cancel count. It returns true when a curve or an area was drawn. Esc calls it after `cancel()` finds no target mode. When it returns true, Esc does not call `onIdleEscape`.
- `siege(queue)`, `stop`, `build(kind, batch)`: use `game/commands.ts` and send the result. `build` sends nothing without a selected own factory. `batch` asks for `BATCH` (5) jobs per factory.
- `buildSlot(index, batch)`: builds `slotKind(session.buildPage, index)`. An empty slot does nothing.
- `cancelJob(factory, jobs, many)`: sends the one intent from `commands.cancelJobs`, if any.
- `showBuildPage(page)`: sets `session.buildPage`.
- `adjustQuota(kind, delta)`: sends the intents from `commands.quota`, one per selected own factory.
- `enterTarget(kind)`: sets `session.targetMode` when the selection holds an own unit and the guide allows it. `cancel()` calls `session.endTarget()`.
- `hoverTarget(at)`: in guard mode, sets `session.guardHover` to the own unit under `at` that is not selected, else 0. Attack-move mode marks nothing. `Input.update` calls it every frame with the pointer position, so the mark follows units that move under a still cursor.
- `targetAt(sx, sy, mods)`: leaves the mode, then acts by kind. Guard: picks an own unit that is not selected and sends `commands.guard` with `mods.queue`. A miss sends nothing. Attack-move: finds the ground point and sends `commands.attackMoveAt` with `mods`.
- `jumpTo`: `centerOn`. `zoom`: `zoomAt`.
- `acknowledge()`: `guide.acknowledge()`. The `continue` hotkey calls it.
- `hotkey(key, shift, at)`: a `switch` on `Hotkey.t` that calls the owning group. `shift` queues a siege toggle, builds a batch for a `slot` key, or adds for an idle-selection key. A `group` key goes to `groupKey` (`input/groupKeys.ts`, `client/game/control-groups.md`). `groupKey` gets `ctx.select` as its `select`, so a recall selects only the members the guide allows. `home` calls `goHome`. See `client/game/commands.md`.

`goHome(session, cam)` centres the camera on the player's first factory and returns false if there is none. `actions.ts` re-exports it. The frame loop calls it once per session.

## Flow

```
Pointer / Keys / HUD  ->  Actions  ->  Session.select | camera | send(Intent)
                                                              |
                                                     host.intent(session.self, intent)
```

## Invariants

- `Actions` never touches the DOM. DOM listeners live in `Pointer`, `Keys`, and the `ui/` classes.
- A `null` intent is never sent (`emit` checks).
- Only the intent the guide admits is sent (`send` checks).
- Actions change the selection only through `ctx.select` and `ctx.unselect`. Only `ctx.select` adds ids, and it asks the guide.
- A group calls another group only through `hotkey`. The calls go to the inner groups, so a wrapper such as `withActionSounds` sees only the outer call.

## Recipe: add an action

1. Add the method to the group interface that owns its concern. A new concern is a new file in `input/actions/` and one more spread in `createActions`.
2. Implement it with `ActionContext` and `game/` helpers for the rules.
3. Call it from `Pointer`, `Keys` (via a `Hotkey`) or a `ui/` class.
