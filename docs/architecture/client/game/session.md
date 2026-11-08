Source: apps/client/src/game/session.ts, apps/client/src/game/selection.ts, apps/client/src/game/lookup.ts

# Session, selection and lookups

## Session

`Session` is the running game as this client sees it.

- `lockstep`: `Lockstep | null`. Null before welcome and after a stop or desync.
- `me`: the local player id, or -1.
- `self`: the player id this client commands. Equal to `me` unless a spectator watches another player. `sandbox`: dev sandbox, this client commands every side (`client/app/local-host.md`).
- `selfName`: getter, the name of the player this client is, or "".
- `pickWorld`: the choose-your-start phase's world (terrain, no players), or null. Never set with `lockstep` (`client/app/pick-scene.md`). `startPick(you, world)` sets it.
- `homed`: true once the camera has jumped to the first factory.
- `buildPage`: the build palette page shown. The grid keys use it too (`client/ui/build-grid.md`).
- `curve`: the right-drag curve move being drawn, or null.
- `area`: the right-drag area reclaim being drawn (`ReclaimArea`, `client/game/commands.md`), or null.
- `targetMode`: `TargetKind | null`. `"guard"` while the next left click picks the unit to guard, `"attackMove"` while it picks the ground point to attack-move to. One field, so only one mode can be on.
- `guardHover`: in guard mode, the own unit under the cursor that a click would guard. 0 = none. `Actions.hoverTarget` writes it every frame. `fillFrame` copies it to `Frame`.
- `endTarget()`: leaves the target mode.
- `groups`, `lastRecall`: control groups and the last recall (`client/game/control-groups.md`).
- `world`: getter, `lockstep?.world ?? null`.
- `player`: getter, the local `Player` record.
- `selected`: `readonly number[]`, sorted unit ids. `selectedSet`: the same as a `Set`.
- `start(me, lockstep)`: sets both, then resets: `homed`, curve, area, groups, target mode, selection.
- `stop()`: clears lockstep and `me`, then the same reset.
- `select(ids)`: replaces the selection. It rebuilds both forms. An empty selection leaves the target mode.
- `pruneSelection()`: once per frame. Drops ids of dead units. It keeps the same array object when nothing changed, so a reference check is enough to see a change.

The selection and the control groups are client state. The sim does not know them. Commands carry the selected ids in the intent.

## selection.ts (pure)

- `combine(current, hit, additive)`: the new selection. Additive merges, dedupes and sorts.
- `ownUnits(units, me, kind?)`: ids of own units, optionally of one kind.
- `pruneDead(selected, units)`: removes missing ids. Returns the same array when none are missing.

## lookup.ts (pure)

- `unitById(units, id)` and `playerById(players, id)`: binary search. They require the sim's id sort.
- Use them anywhere you hold an id and need the record. A linear `find` is not needed.

## Invariants

- Only `Session.select` changes the selection, so `selected` and `selectedSet` never disagree.
- Dead selected units drop out at most one frame late.
- `session.me` is the id from the current `welcome`. Each match gives a new one (`net/match-messages.md`).
