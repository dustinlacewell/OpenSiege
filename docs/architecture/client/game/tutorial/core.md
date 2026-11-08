Source: apps/client/src/game/tutorial/types.ts, apps/client/src/game/tutorial/policy.ts, apps/client/src/game/tutorial/runner.ts, apps/client/src/game/tutorial/guide.ts, apps/client/src/game/tutorial/enemy.ts, apps/client/src/game/tutorial/match.ts

# Tutorial core

Pure rules for a lesson: what each step allows, what it points at, and when it is done. No DOM. No sending.

## types.ts

Plain data. No logic except the `rule` helper.

- `Lesson` = `{ zones, steps }`. A `Zone` is a named circle in world units.
- `Step` is one of two kinds:
  - `TaskStep` = `{ t: "task", id, prompt, policy, focus, done, enemy?, freeze? }`. The player does something. It ends when `done` holds. With `freeze`, time stops until the player sends the step's first intent. The selection stays free, so the player can select and give the order in stopped time.
  - `NoteStep` = `{ t: "note", id, prompt, focus, enemy? }`. An explanation. Time stops while it shows. No intent passes and the selection does not change. The camera stays free. It ends when the player presses Continue.
- `EnemyScript` = `(world, enemy) => Intent[]`. A step's `enemy` gives the intents the scripted enemy sends once, when the step starts.
- `Policy` = `{ intents, selectable, commandable }`. `intents` is a list of `IntentRule`. `selectable(unit, me)` says which units may be selected. `commandable(unit, me)` says which units a unit order may name. The camera is never restricted.
- `IntentRule` = `{ t, where? }`. Without `where`, every intent with tag `t` passes.
- `rule(t, where?)` makes a rule. `where` gets the intent already narrowed to tag `t`. No casts.
- `Focus` = `{ controls, units, zones, gesture? }`. `controls` are HUD controls (`ControlId`). `units(world, me)` gives unit ids. `zones` are zone names. `gesture(world, me)` gives a `Gesture` or null: `{ shape, from, to }`, a right-drag the renderer acts out on the ground. `line` is a curve move; `circle` is an area reclaim centred on `from`. It reads the world, so it can point at wrecks left mid-lesson. `follow(world, me)` gives the unit ids the camera tracks (`camera-glide.md`); empty means no tracking.
- `Observation` = `{ world, me, selected, sent, camera, cameraStart }`. `done` reads it. `sent` holds the intents the player sent since the step began, in order. `camera` and `cameraStart` are `CameraPose`s (`{ x, y, yaw }`): the camera now and when the step began.
- `GuideView` is what the HUD and renderer draw: prompt, step index and count, `note`, controls, unit ids, zones resolved by name, `gesture` (or null) and `follow` (empty when the step has none).

## policy.ts

- `admit(policy, intent, world, me)`: the intent to send, or null to drop it.
  1. No rule has the intent's tag: null.
  2. A unit order (`move`, `guard`, `stop`; attack-move is a `move`) loses every unit that is missing or not `commandable`. With none left: null. When nothing goes, it is the same object.
  3. The rules decide on the narrowed intent (`permits`).
  Other tags are never changed, so a siege on a factory still passes where a rule allows it.
- `permits(policy, intent, world, me)`: true when a rule has the intent's tag and its `where` is absent or true.
- `mayIssue(policy, t)`: true when a rule has tag `t`. Input asks this before it enters a mode with no intent yet (guard, attack-move). The HUD asks it for cancel and quota.
- `allowedSelection(policy, world, me, ids)`: the ids whose unit exists and is selectable. Input order stays.
- `FREE_POLICY`: every tag, every unit selectable and commandable. The tag list is a `Record<Intent["t"], true>`, so a new intent tag is a type error until it is listed. The local match already drops `join` and `leave` from players (`client/match/local-match.md`).

## runner.ts

Every function returns a new state. Inputs do not change.

- `TutorialState` = `{ index, sent, acknowledged, cameraStart }`. `index` equals `steps.length` when the lesson is done. `acknowledged` is true once Continue was pressed in this step. `cameraStart` is the camera when the step began.
- `startTutorial()`: index 0, `sent` empty, not acknowledged, `cameraStart` null.
- `noteSent(state, intent)`: appends to `sent`.
- `acknowledge(state)`: sets `acknowledged`. Only a note reads it.
- `advance(lesson, state, view)`: the first view sets `cameraStart`. If the current step is done, go to the next step, clear `sent` and `acknowledged`, and set `cameraStart` to the view's camera. A note is done when acknowledged. A task is done when its `done` holds. At most one step per call. A done lesson returns the same state.
- `finished`, `currentStep`: `currentStep` is null when the lesson is done.
- `guideView(lesson, state, world, me)`: null when the lesson is done. `note` is true on a note step. An unknown zone name throws. That is a bug in the lesson.

## guide.ts

`Guide` is the one seam that input, HUD and renderer use. One implementation per match kind.

```
admit(intent): Intent | null   // what to send, maybe with units taken out; null drops it
mayIssue(t): boolean
selectable(ids): number[]
paused(): boolean              // true while time stops: a note, or a freeze task before its first intent
holdsSelection(): boolean      // true while a note shows: no click changes the selection
acknowledge(): void            // Continue: ends the current note; nothing on a task
noteSent(intent): void         // once per intent actually sent
update(): void                 // once per frame
view(): GuideView | null
```

- `NO_GUIDE`: a normal match. `admit` returns the intent. Everything else passes. `selectable` returns a copy of the ids. Never paused. `view` is null.
- `TutorialGuide(lesson, read)`: the only stateful part. It holds a `TutorialState` and nothing else. `read()` gives `{ world, me, selected, camera }`, or null before the match has a world. In `ClientLink.view` it is also null until the camera has jumped home, so the jump does not count as the player's pan.
- `update()` calls `advance` with `read()`. It does nothing when `read()` is null.
- On a task step, `admit`, `mayIssue` and `selectable` use its policy. On a note step, `admit` is null, `mayIssue` is false and `selectable` is empty. When the lesson is done they act like `NO_GUIDE`.
- While a step runs and `read()` is null, `admit` is null and `selectable` is empty. A `where` needs a world.
- `paused()` is the runner's `isPaused`: a note step, or a freeze task with nothing sent yet. `holdsSelection()` is true on a note step only. `acknowledge()` calls the runner's `acknowledge` on a note step only. The next `update` moves on.
- `stepIndex()` (not on the interface): the current index, or null when the lesson is done. The enemy script reads it.
- `view()` builds from the current `read()`. Null when `read()` is null or the lesson is done.
- `GuideSlot`: holds one current `Guide` and passes every call to it. It starts as `NO_GUIDE`. `set(guide)` swaps it. `startClient` builds one slot and hands it to actions, HUD, loop and the link once. `LocalHost.tutorial()` sets a `TutorialGuide` through `link.guide`. `link.stop()` sets `NO_GUIDE`.

## enemy.ts

`tutorialEnemy(lesson, guide, player)` is a `LocalBot` (`client/match/local-match.md`). `guide` is anything with `stepIndex()`.

- On each think it sends the `enemy` intents of every step entered since the last think, in step order, once each.
- Bots do not think while a note pauses the match. So a note's intents go out on the first turn after it ends. Time stood still, so the world is the same as when the note began.
- A finished lesson sends nothing.

## match.ts

`tutorialMatch()` gives `{ world, you, enemy, lesson }`: the starting world with both players joined, the local and enemy player ids, and the lesson. Pure.
