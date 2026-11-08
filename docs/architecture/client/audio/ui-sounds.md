Source: apps/client/src/audio/uiHooks.ts, apps/client/src/audio/intentCues.ts, apps/client/src/audio/cues.ts

# Interface sounds

`Actions` does not know about sound. `startClient` wraps the parts it hands to `createActions`. The seam is `UiSounds { ui(cue) }`.

## withIntentSounds(send, session, sounds)

Wraps `send`. Each intent plays `intentCue(intent, world, me)`:

- `move`, `attack`, `guard`, `reclaim`, `rally`: `ack`.
- `build`: `queued`, or `refused` when the player has fewer credits than the cost or the factory queue is full (`MAX_QUEUE`). This is a guess from the local world. The sim decides.
- Other intents: nothing.

## withActionSounds(actions, session, sounds)

Returns an `Actions` with five methods wrapped. The rest pass through.

- `clickSelect`, `kindSelect`, `boxSelect`, `selectOnly`, `hotkey`: `select` plays when the selection array changed and is not empty.

There is no mute key. `AudioEngine.toggleMute` exists but nothing calls it. The HUD and the input both get the wrapped `Actions`.
