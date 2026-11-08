Source: apps/client/src/audio/worldEvents.ts, apps/client/src/audio/worldSounds.ts, apps/client/src/audio/cues.ts, apps/client/src/game/shotTracker.ts

# Sound events

World sounds come from comparing world states between sim steps. The sim does not know about sound.

## WorldSounds

`WorldSounds.update(world, me, cam, now)` runs once per frame, after `Effects` (`client/app/frame-loop.md`).

- A new `world` object (new `Lockstep`) resets. What already exists makes no sound.
- When `world.tick` changed, it collects the events, mixes them (`client/audio/mixer.md`), throttles them, and sends each voice to the `VoiceSink`.
- It gets a `() => SoundTuning` getter (`startClient` passes `() => audio.tuning`). It reads the getter on every update, so `AudioEngine.setTuning` reaches the mix and the throttle without a rebuild.
- The `heard(x, y)` callback is injected. `startClient` passes `(x, y) => vision.sees(x, y)` (`client/game/vision.md`). The default hears every point.

## Detection

`markWorld(world, me)` copies what the next compare needs, because the sim mutates `World` in place. `diffWorld(before, world, me, elapsed, gone, out)` is pure.

| Cue | Rule |
|---|---|
| `shotDirect`, `shotBallistic` | `lastFired < elapsed`, the same rule as muzzle flashes. The weapon kind from `UNIT_STATS` picks the cue. |
| `shellGround`, `shellArmor`, `roundGround`, `roundArmor` | A shell that vanished. `ShotTracker` reports it, the same detector `Effects` uses. `impactCue` picks the cue (`client/audio/impact-choice.md`). Size is `splash / 180`. |
| `destroyed` | An id in the last marks that is not in the world now. Size by kind. |
| `built` | An own factory's head job progress dropped, or its queue emptied. |
| `underAttack` | An own unit's `hp` dropped. |
| `deploy`, `pack` | `mode` changed to `deploying` or `packing`. |
| `credits` | The local player's credits went up. |

`built`, `underAttack` and `credits` are not spatial. They play centred, wherever the camera is. `own` marks events at an own unit; those skip the fog test.

## Recipe: add a world sound

1. Add the cue to `WorldCue` in `cues.ts`.
2. Push the event in `diffWorld`. Add a field to `UnitMark` if the rule needs one.
3. Add a synth in `synthVoices.ts` (`client/audio/synth-voices.md`), or add it to `SampledCue` and give it a recipe in `recipes.ts` (`client/audio/weapon-recipes.md`).
4. Add the cue to `CUES` in `soundTuning.ts` and a row in `soundTuning.json` (`client/audio/tuning.md`). Set a min gap there if it can repeat often. The tests fail until `CUES`, `SYNTHS`, `RECIPES` and the file agree.
