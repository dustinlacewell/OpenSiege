Source: apps/client/src/audio/soundTuning.ts, apps/client/src/audio/soundTuning.json, apps/client/src/audio/defaultTuning.ts, apps/client/src/audio/voiceBudget.ts

# Sound tuning

Every tuned sound number lives in one object, `SoundTuning`. No other file holds a copy. The mixer, the throttle and the engine read it. The dev sound page (`client/dev/sound-editor.md`) edits it and swaps it in with `AudioEngine.setTuning`.

## The data

- `soundTuning.json` is the shipped values. `defaultTuning.ts` loads it once as `DEFAULT_TUNING` and throws at startup if it is invalid. The composition root (`startClient`) passes it to `AudioEngine`.
- `SoundTuning = { cues: Record<Cue, CueTuning>, global: GlobalTuning }`.
- `CUES` lists every cue. A test keeps it equal to the keys of `SYNTHS` plus `SAMPLED_CUES`, and `SAMPLED_CUES` equal to the keys of `RECIPES`.
- `TUNING_FIELDS` is the one list of fields: scope, key, label, section, unit, help, min, max, decimals, step. The validator and a dev editor both read it. `TUNING_SECTIONS` names the groups.
- `parseSoundTuning(json)` returns the tuning or all errors (each has a column, a field and a message). It checks every cue, unknown cues and keys, range, decimals, whole numbers, and the cross rules below. `serializeSoundTuning` writes a stable order with a trailing newline. `columnCrossErrors(column, values, voiceCap)` runs the cross rules for one column, for an editor that checks a column at a time.

## Per cue

- `rank` (0..1000): importance. Higher wins.
- `atOnceLimit` (1..64): most voices of this cue together.
- `minGapSeconds` (0..60): least time between two plays. 0 = never throttled.
- `baseGain` (0..2): multiplies the voice gain.

## Global

- Budget: `voiceCap`, `reservedSlots`, `protectedRank`.
- Level: `masterGain`, `maxGain`.
- Mix: `mergeBoost`, `hearingRange`.
- Zoom: `zoomFloor`, `zoomNear`, `zoomFar` (`client/audio/mixer.md`).

Cross rules: `reservedSlots < voiceCap`, each cue `atOnceLimit <= voiceCap`, `zoomNear < zoomFar`.

## Budget rules

`admit(cue, tuning, active)` checks in this order:

1. The cue already has `atOnceLimit` voices: `cueFull`.
2. The total is at `voiceCap`: `capFull`.
3. The total is in the last `reservedSlots` and the cue `rank` is below `protectedRank`: `reserved`.
4. Otherwise `play`.

So low-rank sounds (shots, impacts) cannot fill the last slots. Alerts and interface sounds can. A refused voice is dropped, not queued.

## Recipe: add a tuned field

Add it to the interface, to `TUNING_FIELDS`, and to every row of `soundTuning.json`. The parser rejects a file that lacks it.
