Source: apps/client/src/audio/recipes.ts, apps/client/src/audio/cues.ts

# Weapon recipes

The six weapon cues play samples, not live synths. `SampledCue` lists them; `SAMPLED_CUES` is the same list as a value, and `isSampled(cue)` tests a cue.

`type Recipe = (sr, seed, size) => Float32Array`. Pure. It returns mono at `sr`. `size` is 0..1. `RECIPES: Record<SampledCue, Recipe>`.

Each recipe sums its layers (`client/audio/dsp-core.md`), then adds 0.3 × `LAND_ECHOES`, normalises the peak to 0.9, and fades the last 4 ms. A recipe jitters its own numbers from the seed, so each seed is a different take.

## The cues

- `shotBallistic` (howitzer firing): a clean report. A smooth body, a 180 Hz shockwave thump, a little air, a fireball. 0.9 s.
- `shellGround` (shell into dirt): a slow, dark, gritty body, a crunch, a deep shockwave, air, a big fireball, then dust. About 1.0-1.9 s; `size` makes it longer.
- `shellArmor` (shell into steel): a hard body, air, a dense crunch under 3.5 kHz, a low shockwave and a small sharp one, a smaller fireball. No dust.
- `shotDirect` (tank main gun): sharper and shorter than the howitzer. A smooth bright body, a 300 Hz shockwave, air, a short fireball. 0.6 s.
- `roundGround` (tank round into dirt): a short gritty body, a crunch, a shockwave, a little dust.
- `roundArmor` (tank round into steel): a hard gritty body, a dense crunch, air, a sharp and a low shockwave.

## Limits the tests hold

At 48 kHz, for sizes 0, 0.5 and 1 and two seeds: every sample is finite, the peak is at most 0.9, the length is at most 2 s, the same seed gives the same samples, and another seed gives others. Octave bands over the first 1.2 s: 250 Hz and 500 Hz are within 6 dB of the loudest band, and 4 kHz is at least 10 dB below it. Phones play the 250-500 Hz band; the 4 kHz band is the "ksh" that sounds thin.

## Recipe: change a weapon sound

Edit its function in `recipes.ts`. Run `node --test apps/client/test/recipes.test.ts`. Reload the page to hear it.
