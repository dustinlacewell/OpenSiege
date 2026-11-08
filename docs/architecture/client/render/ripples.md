Source: apps/client/src/render/ripples.ts, apps/client/src/render/rippleField.ts, apps/client/src/render/ripplePrograms.ts, apps/client/src/render/rippleShader.ts, apps/client/src/render/rippleGrid.ts, apps/client/src/render/groundWatch.ts, apps/client/src/render/stepClock.ts, apps/client/src/game/rippleSources.ts

# Ripples

Wakes and splashes on the water. A damped wave equation runs on the GPU in a texture over the map. The water shader reads the result.

## Texture contract

`RipplePass.texture` is the output. The water pass samples it on `RIPPLE_UNIT` (7).

- `RGBA16F`, `LINEAR`, `CLAMP_TO_EDGE`, no mips.
- Covers the map: uv = world xy / (`mapWidth`, `mapHeight`).
- R: surface offset, world units. Negative is a trough.
- G, B: slope d/dx and d/dy of R, world units per world unit. Central differences.
- A: foam, 0..1.
- Null without `EXT_color_buffer_float`. Then `update` does nothing.
- Null until the first `update`.

## Field

`rippleGrid` sizes the field. One texel is 16 world units (`RIPPLE_TEXEL`). The long side is capped at 1024 texels and at `MAX_TEXTURE_SIZE`. Texels grow to fit the cap and stay square before rounding. The default 16000 by 16000 map gets 1000 by 1000 texels.

`RippleField` holds the GPU memory for one terrain:

- Two state targets, `RGBA16F`, `NEAREST`. They swap each step. R height, G vertical velocity, B foam.
- The output target, `RGBA16F`, `LINEAR`.
- The ground texture, `R16F`, one texel per terrain vertex, `LINEAR`. It holds sea level − ground height, so water is positive.

About 24 MiB on the default map.

## Land and terrain refresh

The sim gives no hook when heights change. `GroundWatch.check(terrain)` runs on each `update`:

- A new `Terrain` object, or a new vertex count: dispose the field and build a new one.
- A changed `seaLevel`, or a height that differs from its copy: re-upload the ground texture only.
- Each call compares 8192 heights (`GROUND_WATCH_WINDOW`) and moves on. A dig shows within a few frames. The default map has 16641 vertices, so two frames.

When no vertex is below sea level, the field never steps.

## Frame

`update(f, terrain)`, once per frame before the scene:

1. `GroundWatch` check, as above.
2. `StepClock.advance(f.time)`: real seconds since the last frame (at most 0.1), and fixed steps at 60 Hz, at most 4. Time past the cap is dropped.
3. `RippleSources.collect` writes this frame's splats into the instance buffer.
4. Splat pass: draw the splats into the current state.
5. Step pass, once per fixed step.
6. Output pass.
7. Unbind the framebuffer, reset the viewport, bind the output on `RIPPLE_UNIT`, active unit back to 0.

Steps 4 to 7 are skipped when there are no splats and no steps.

## Splat

One instanced quad per splat (`MAX_SPLATS` 256 per frame). A splat is x, y, radius, height, foam. The quad reaches 1.5 radius. The shader adds a gaussian with sigma = radius / 2 to height and foam. Velocity is left alone. GL state is `accumulate` (`glState.ts`): plain sum, so troughs can go negative.

## Step

Semi-implicit Euler on the state:

- v += c² · ∇²h, with c² per axis = (`WAVE_SPEED` / 60 / texel)², capped at 0.24 for stability. `WAVE_SPEED` is 150 world units per second.
- v *= 0.99. A wave halves in about 1.2 s.
- h += v.
- Height and velocity scale by wet = clamp(depth / 6, 0, 1). Land holds no wave. The shore absorbs it.
- Foam keeps 0.97 per step. It grows where the slope passes 0.25, and where water shallower than 25 moves. Foam on land is zero.

The map edge clamps the neighbour reads, so waves reflect there.

Samplers: state on unit 0, ground on `RIPPLE_UNIT`. Units 1 to 6 are not touched.

## Sources

`RippleSources` (`client/game`, no GL) turns the frame into splats.

- Wakes (`emitWakes`): each unit that `vision.shows`, with a previous pose, whose centre at `f.alpha` is in water (`inWater`). Speed is the last tick's move per second. Under 5 world units per second, no wake. Height = −0.06 · speed · (radius / 50) · dt. Foam = 0.02 · speed · dt. Radius from `UNIT_STATS`.
- Splashes (`emitSplash`): shells that vanished this tick (`ShotTracker`, at their next position, as smoke and explosions place them) and death blasts (`DeathBlasts`). Each must be in water, within half its radius above the surface, and seen (`vision.sees`). Radius at least 30. Height = −min(60, 0.3 · radius). Foam 1. The trough spreads out as a ring.

A new `world` object resets the trackers. Shells and blasts already there do not splash.

## Tests

`apps/client/test/rippleSources.test.ts`, `rippleGrid.test.ts`, `groundWatch.test.ts`, `stepClock.test.ts`. The GPU passes have no test.
