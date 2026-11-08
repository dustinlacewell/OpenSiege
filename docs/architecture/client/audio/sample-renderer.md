Source: apps/client/src/audio/sampleRenderer.ts, apps/client/src/audio/renderWorker.ts, apps/client/src/audio/renderMessages.ts, apps/client/src/audio/inFlight.ts, apps/client/src/audio/samplePlayer.ts

# Sample renderer

There is no fixed bank of weapon sounds. Every weapon voice is rendered fresh, off the main thread, with its own random seed. One render takes about 3 to 15 ms.

## Rendering

- `AudioEngine` makes a `SampleRenderer` when it is constructed, at page load. The renderer starts a module worker (`renderWorker.ts`) at once. The DSP needs no AudioContext.
- The render rate is 48000 until `unlock` creates the context. Then it is the context's rate. An `AudioBuffer` can have any rate, so a render at 48000 still plays.
- `render(cue, size, seed, onReady)` posts `{ id, cue, seed, size, sr }` to the worker. The message types are in `renderMessages.ts`.
- The worker runs `RECIPES[cue](sr, seed, size)` (`client/audio/weapon-recipes.md`) and posts `{ id, samples }` back. `samples` is transferred, not copied. The renderer calls `onReady(samples, sr)`.
- At most 8 renders are pending at once. `InFlight`, a pure class, holds them. A ninth request is refused: `render` returns false.

## Playing

- In `AudioEngine.play`, after `admit` says `play`, a weapon cue holds its voice slot at once. It counts in the total and per cue while it renders.
- The seed is a random 32-bit integer from the engine's random source (default `Math.random`).
- A refused render frees the slot and counts the drop as `busy`.
- When the samples arrive and the context is running and not muted, the engine makes a mono `AudioBuffer` and plays it. When the engine is muted or stopped by then, it frees the slot and plays nothing.
- `playSample` plays the buffer through an `AudioBufferSourceNode` into the voice gain, then the panner and master, like a synth. 0.08 of it goes to the outdoor echo, because the samples carry their own echoes.
- `playbackRate` is jittered by ±4% (`jitterRate`).
- The slot is held for the buffer's length divided by the rate, plus 0.1 s.
