Source: apps/client/src/audio/synthVoices.ts, apps/client/src/audio/synthParts.ts

# Synth voices

There are no audio files. Every cue except the weapon cues is made with Web Audio nodes when it plays. The weapon cues play samples rendered fresh for each play (`client/audio/weapon-recipes.md`, `client/audio/sample-renderer.md`).

## Parts

- `makeNoise(ctx)`: one second of white noise. The engine makes it once.
- `makeEcho(ctx)`: the impulse of an open field, 1.2 seconds long. It darkens as it fades. The engine makes it once.
- `tone(v, type, f0, f1, peak, decay, start)`: one oscillator that sweeps from `f0` to `f1` Hz.
- `noise(v, filter, freq, peak, decay, start)`: the shared noise through one biquad filter, from a random offset.
- `tone` and `noise` use a 4 ms attack and an exponential decay.
- `rumble(v, f0, f1, peak, decay, start, attack, roll)`: noise through two flat low-pass filters whose cutoff falls from `f0` to `f1`. `roll` adds slow random swells. Steps under 0.1 s buzz like sheet metal.
- All three return their end time.
- `saturate(v)` and `echoed(v, amount)` wrap a `VoiceOut`. `saturate` soft-clips, so phone speakers carry low booms. `echoed` sends `amount` of the sound to the echo.

`VoiceOut` is `{ ctx, out, echo, noise, t }`. `out` is the voice gain node. `echo` is the echo send, already scaled by the voice gain. `t` is the start time.

## SYNTHS

`SYNTHS: Record<SynthCue, Synth>`. `SynthCue` is every cue that is not a `SampledCue`. `SYNTHS[cue](v, size)` schedules one sound and returns its length in seconds. `size` is 0..1. The peaks set each cue's loudness against the others.

- `destroyed`: a tiny dull click, a falling sine (the "bwoom"), a heavy low noise body, a long uneven rumble and a late aftershock. The sine and body are saturated. Almost no noise above 1 kHz; that band is the "ksh" that sounds like sheet metal. `size` makes it longer.
- `deploy` and `pack`: a square clunk and a noise knock, in opposite order.
- `built`, `underAttack`, `credits`: short tones. Quiet.
- UI: `ack` a soft blip, `queued` a rising blip, `refused` a low buzz, `select` a tiny click.

## Recipe: change a sound

Edit its entry in `SYNTHS`. Audition it on the dev sound page at `/sounds.html` (`client/dev/sound-editor.md`). A limiter at the end of the bus stops clipping, but a boom that hits it hard loses its punch. Low-passed noise is quiet, so a deep layer needs a larger peak than a bright one.
