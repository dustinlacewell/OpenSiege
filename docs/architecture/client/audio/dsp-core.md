Source: apps/client/src/audio/dsp/random.ts, apps/client/src/audio/dsp/filters.ts, apps/client/src/audio/dsp/buffers.ts, apps/client/src/audio/dsp/layers.ts, apps/client/src/audio/dsp/echo.ts

# DSP core

Pure sample math for the rendered weapon sounds. No Web Audio, no DOM. It runs in a worker and in node tests.

Every function takes the sample rate `sr` as a parameter. Every random choice comes from an injected `rng: () => number`, so one seed fixes a whole sound.

## Files

- `random.ts`: `rng(seed)` (mulberry32) and `jit(r, x, amt = 0.15)`, which scales `x` by a random factor in `1 ± amt`.
- `filters.ts`: `Biquad`, one RBJ section (`lp`, `hp`, `bp` with 0 dB peak). Cutoff is clamped to 5 Hz .. 0.45 × `sr`. `filt(buf, sr, type, f, q, stages)` filters in place through cascaded sections. `f` may be a function of time; it is re-read every 32 samples.
- `buffers.ts`: `len`, `noise`, `peakOf`, `norm(b, to = 1)`, and `sum(sr, sec, layers)`, which adds `[buf, at, gain]` layers into one buffer and cuts what runs past the end.
- `layers.ts`: the blast layers, after Farnell. Each returns a peak-normalised mono buffer.
- `echo.ts`: `echoes(input, sr, taps)` and the fixed `LAND_ECHOES` taps.

## Layers

- `shockwave(sr, T, lp)`: a Friedlander pressure pulse. It falls through zero at `T`, then has a long shallow negative phase. No pitch. A high `lp` makes a crack; a low one makes a thump.
- `fireball`: noise band-passed at 70 Hz. Its low-pass cutoff falls with a squared rise-fall envelope.
- `air`: the roar. Noise rounded by `tanh`, decayed, band-limited between `hp` and `lp`.
- `dust`: dirt raining back. Noise with a slow random level, low-passed.
- `body`: the weight of the blast, in the 150-1000 Hz band. Noise whose cutoff falls from `f0` to `f1`, with a slow churn. `grit` (default on) saturates it, then takes off the fizz above 2.6 kHz.
- `crunch`: many 1-10 ms noise grains in random bands between `fLow` and `fHigh`. They thin out over `decay`. Loudness is heavy-tailed. The sum is driven through `tanh`.

## Echoes

`LAND_ECHOES` is three taps at 0.11, 0.23 and 0.41 s, each quieter and darker than the last. All are 90 ms or later, so they read as echoes off the land, never as a comb-filter ring. `echoes` returns the wet signal only, the same length as the input.
