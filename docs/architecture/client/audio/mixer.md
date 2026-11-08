Source: apps/client/src/audio/mixer.ts, apps/client/src/audio/throttle.ts, apps/client/src/audio/audioEngine.ts, apps/client/src/audio/voiceBudget.ts, apps/client/src/audio/muteStore.ts, apps/client/src/audio/unlock.ts

# Mixer and master bus

## mixEvents (pure)

`mixEvents(events, listener, heard, global)` turns one step's events into voices. `global` is `GlobalTuning` (`client/audio/tuning.md`). Every tuned number below comes from it.

- The listener is the camera look-at point (`listenerOf(cam, global)`). Hearing range is `hearingRange · cam.dist`. Pan width is `0.6 · cam.dist`; this is pan geometry, a constant in `mixer.ts`, not a tuned value.
- A spatial event that is not `own` and not `heard(x, y)` is dropped. This hides enemy sounds in the fog of war.
- Gain is `(1 - d / range)² · zoom`. Beyond the range the event is dropped.
- `zoom` is `zoomFactor(cam.dist, global)`: 1 at or below `zoomNear`, `zoomFloor` at or above `zoomFar`, linear between. The battle gets quieter as the camera zooms out. Events with no place (alerts, economy) and interface cues are not scaled.
- Pan is the ground offset along screen right, divided by the pan width, clamped to -1..1.
- Events of one cue merge into one voice: the loudest pan, the largest size, gain times `1 + mergeBoost · log2(count)`, at most `maxGain`.
- The output is sorted loudest first.

## Throttle

`new Throttle(gapOf)` takes a function from cue to seconds. `allow(cue, now)` drops a cue that played less than its gap ago. Both callers pass `cue => tuning.cues[cue].minGapSeconds`, read on every call. A gap of 0 never throttles.

## Voice budget

`admit(cue, tuning, active)` in `voiceBudget.ts` is pure. It says if a new voice may start (`client/audio/tuning.md` has the rules).

## AudioEngine

The imperative shell. One `AudioContext`. It is built with a `SoundTuning` and owns the current one (`tuning` getter). `setTuning(t)` swaps it live and updates the master gain.

- Bus: each voice is synth nodes or a freshly rendered sample, then a voice gain (voice gain times the cue's `baseGain`), then a stereo panner, then the master gain (`masterGain`), then a soft `DynamicsCompressor`, then the speakers. Both kinds also feed the shared outdoor echo.
- `play` asks `admit` with its own count of voices now sounding, in all and per cue. It drops the voice unless the verdict is `play`, and counts the drop by reason. A weapon cue holds its slot while it renders. It is dropped as `busy` when the renderer already has 8 renders pending (`client/audio/sample-renderer.md`). A voice counts until its length plus 0.1 s has passed. `stats()` returns the counts for the dev page.
- `unlock()` must run inside a user gesture. It creates the context once and resumes it later. `unlockOnGesture` calls it on the first `pointerdown` or `keydown`. The name form submit calls it too. Before that, voices are dropped.
- `toggleMute()` ramps the master gain to 0 or back to the tuned value. Muted wins over `setTuning`. `muteStore.ts` keeps the choice in `localStorage` (`mf.muted`). Storage errors are ignored.
- `ui(cue)` plays an interface sound, centred, with its own throttle.
