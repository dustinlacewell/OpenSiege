Source: apps/client/src/game/controlGroups.ts, apps/client/src/input/groupKeys.ts, apps/client/src/game/session.ts, apps/client/src/ui/multiView.ts

# Control groups

The player can store a selection under a number key and call it back. Groups are client view state. They live in `Session`, never in the sim, and are never sent.

## Keys

- Alt+1 to 9: group N becomes the own units of the selection. An empty selection empties the group.
- Ctrl+1 to 9 is not a game key. The browser keeps it.
- Shift+1 to 9: the own units of the selection join group N.
- 1 to 9: select the living members of group N. An empty group changes nothing.
- The same number twice within `DOUBLE_TAP_MS` (350 ms): select it and centre the camera on the mean position of its members.

The key time is `KeyboardEvent.timeStamp`, passed in by `Keys`. A third fast press counts as a first press again.

## Data (`controlGroups.ts`, pure)

- `Groups`: an array of 10 sorted id lists. Index N is group N. Index 0 is unused.
- `saveGroup`, `addToGroup`: return new `Groups`. They do not change the old one.
- `liveMembers(groups, n, units)`: the members that still exist.
- `groupOf(groups, id)`: the lowest group that holds the unit, or 0.
- `isDoubleTap(prev, n, at)`, `centreOf(units, ids)`.

## Shell (`input/groupKeys.ts`)

`groupKey(session, cam, n, op, at)` reads the session, calls the pure helpers, writes `session.groups`, `session.lastRecall` and the selection, and moves the camera. `Actions.hotkey` calls it for a `group` hotkey.

A recall stores the pruned list back, so dead units leave the group.

## Badge

A multi-view tile shows the unit's group number in its top-left corner (`.u-group`). `hudModel` gets `groupOf` through its `HudView` input (`client/ui/hud.md`). A unit in several groups shows the lowest.

## Invariants

- `start` and `stop` empty the groups. A new session never sees old ids.
- Only own units enter a group.
