import type { World } from "@mf/sim";
import type { Camera } from "../game/camera.ts";
import { ShotTracker, type ShotState } from "../game/shotTracker.ts";
import type { SoundEvent, VoiceSink } from "./cues.ts";
import { listenerOf, mixEvents, type Heard } from "./mixer.ts";
import type { SoundTuning } from "./soundTuning.ts";
import { Throttle } from "./throttle.ts";
import { diffWorld, markWorld, type Marks } from "./worldEvents.ts";

/** Until the fog of war gives a vision query, every point is heard. */
const HEAR_ALL: Heard = () => true;

/** Once per frame: finds what changed in the world since the last step and plays it. */
export class WorldSounds {
  private readonly shots = new ShotTracker();
  private readonly throttle: Throttle;
  private world: World | null = null;
  private tick = 0;
  private marks: Marks = { units: new Map(), credits: 0 };

  /**
   * `tuning()`: the tuning in force, read each update so a live swap reaches this class.
   * `heard(x, y)`: may the player hear a sound there. Enemy sounds where it is false stay silent.
   */
  constructor(
    private readonly out: VoiceSink,
    private readonly tuning: () => SoundTuning,
    private readonly heard: Heard = HEAR_ALL,
  ) {
    this.throttle = new Throttle((cue) => tuning().cues[cue].minGapSeconds);
  }

  /** `now` is seconds. */
  update(world: World, me: number, cam: Camera, now: number): void {
    if (world !== this.world) this.reset(world, me);
    if (world.tick === this.tick) return;
    const events = this.detect(world, me, world.tick - this.tick);
    const g = this.tuning().global;
    for (const v of mixEvents(events, listenerOf(cam, g), this.heard, g)) {
      if (this.throttle.allow(v.cue, now)) this.out.play(v);
    }
  }

  /** A new lockstep: start comparing from here, with no sounds for what already exists. */
  private reset(world: World, me: number): void {
    this.world = world;
    this.tick = world.tick;
    this.shots.clear();
    this.shots.observe(world.projectiles, () => {});
    this.marks = markWorld(world, me);
  }

  private detect(world: World, me: number, elapsed: number): SoundEvent[] {
    this.tick = world.tick;
    const gone: ShotState[] = [];
    this.shots.observe(world.projectiles, (s) => gone.push({ ...s }));
    const events: SoundEvent[] = [];
    diffWorld(this.marks, world, me, elapsed, gone, events);
    this.marks = markWorld(world, me);
    return events;
  }
}
