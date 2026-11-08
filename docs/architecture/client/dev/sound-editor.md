Source: apps/client/sounds.html, apps/client/src/dev/soundEditor/, apps/client/devSoundPlugin.ts, apps/client/test/soundTable.test.ts, apps/client/test/soundRules.test.ts, apps/client/test/auditionModel.test.ts

# Sound tuning editor

A dev-only page at `/sounds.html`. It edits `apps/client/src/audio/soundTuning.json`, the sound tuning (`client/audio/tuning.md`). A save is real. The page is not in the production build, and `main.ts` throws unless `import.meta.env.DEV`. The landing screen's dev strip has a "sounds" link to it, shown in dev builds only.

The page is a table editor (`client/dev/table-editor.md`) with a sound adapter, and an audition panel under the table.

## Table

Columns are the 13 cues in `CUES` order, then `Global`. Rows are the fields of `TUNING_FIELDS`, in `TUNING_SECTIONS`. The table is ragged: a cue field shows in the cue columns only, a global field in the `Global` column only. The other cells are blank. Cell bars compare a field across the columns that have it.

## Adapter

| File | Role |
|---|---|
| `soundSchema.ts` | `TUNING_FIELDS` and `TUNING_SECTIONS` as a `Schema`. Every field is a number. |
| `soundTable.ts` | Pure. `SoundTuning` to the table and back (`tuningToTable`, `tableToJson`, `tableToTuning`). |
| `soundRules.ts` | `field` is `specFieldError`. `cross` is the audio core's `columnCrossErrors`. Every cell is relevant. Also `soundLabel`. |
| `api.ts` | `createHttpRemote("/__dev/sound-tuning")` with a `Codec` that holds the conversion. |
| `persist.ts` | `createLocalStore("mf.soundEditor", ...)`. |
| `main.ts` | Builds the adapter, starts `TableEditor`, mounts the audition panel, joins them with `editor.onChange`. |

A cue's `atOnceLimit` is checked against the global `voiceCap`. This is the one rule that reads another column. `soundRules(voiceCap)` takes the cap as a function, and `main.ts` reads it from the draft.

## Save route

`devSoundPlugin.ts` registers `/__dev/sound-tuning` with `devJsonPlugin`. `parse` is `parseSoundTuning`. `serialize` is `serializeSoundTuning`. 422 returns `{errors}` as `{column, field, message}`, which is a `Refusal`. The write makes Vite reload the pages.

## Audition panel

`auditionView.ts` plays the real `AudioEngine` and `mixEvents`. `auditionModel.ts` is the pure part.

- The draft reaches the engine through `engine.setTuning` on every change. `draftToTuning(draft, last)` returns the parsed draft, or `last` when any cell is invalid. The engine never gets a broken tuning.
- A button per cue plays it once. An interface cue goes to `engine.ui`. A world cue goes through the mixer. `underAttack`, `built` and `credits` play centred, the others are placed.
- Mute switch (`engine.toggleMute`).
- Camera distance slider, from `zoomNear` to `zoomFar`, default 3000. It sets the distance of a fake camera. `listenerAt(dist, global)` makes the listener for `mixEvents`, so hearing range and the zoom factor apply.
- Stress buttons: 50 shots in 1 s, 30-unit order, big fight, alert under load. `scenarios(reach)` is a list of `{atMs, event}` (or `{atMs, ui}` for an interface sound), placed on a spiral inside `reach`. The view passes half the hearing radius. `bucketByStep` groups a scenario into 50 ms steps. The view runs one timer per step: one `mixEvents` call, then the throttle (gap read from the engine's tuning), then `engine.play`. As `WorldSounds` does. Stop clears the timers.
- Live readout, four times a second from `engine.stats()`: voices playing out of `voiceCap`, voices per cue, and the drops `cueFull`, `capFull`, `reserved` and `busy` (shown as "Renderer busy"). Reset sets a baseline; the engine's own counts are not touched.

## Layout

`#audition` sits between the table and the info strip, as a flex child of `#app`, with its own scroll. The table keeps its own scroll, so its sticky header and label column work as on the unit page. `soundEditor.css` hides the unused header slot.
