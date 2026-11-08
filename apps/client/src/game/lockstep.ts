import { HASH_EVERY } from "@mf/protocol";
import type { SimState, Stamped, World } from "@mf/sim";
import { launchPoint, type PrevPose, type PrevShot } from "./interp.ts";
import { TerrainWatch } from "./terrainWatch.ts";
import { advance, dueTick, noteArrival, type Playout, progress, startPlayout } from "./playout.ts";

export interface Turn {
  tick: number;
  intents: Stamped[];
}

export interface LockstepDeps {
  step(state: SimState, intents: readonly Stamped[]): void;
  hash(world: World): number;
  onHash(tick: number, hash: number): void;
}

/**
 * Steps the world once per received turn, in order, paced by a jitter-buffered playout clock.
 * Before each step it records each unit's pose and each shell's position so the view can interpolate.
 */
export class Lockstep {
  readonly prev = new Map<number, PrevPose & { gen: number }>();
  readonly prevShots = new Map<number, PrevShot & { gen: number }>();
  /** The terrain boxes the stepped turns changed; the frame takes them. */
  readonly terrainWatch = new TerrainWatch();
  private readonly queue: Turn[] = [];
  private lastQueued: number;
  private clock: Playout;
  private gen = 0;

  readonly world: World;

  constructor(private readonly sim: SimState, private readonly deps: LockstepDeps, now: number) {
    this.world = sim.world;
    this.lastQueued = sim.world.tick;
    this.clock = startPlayout(sim.world.tick, now);
  }

  get queued(): number {
    return this.queue.length;
  }

  /** The tick the next turn must carry. */
  get expected(): number {
    return this.lastQueued + 1;
  }

  /** Accepts only the `expected` turn. Any other tick is refused with false; the caller treats it as a desync. */
  receive(turn: Turn, now: number): boolean {
    if (turn.tick !== this.lastQueued + 1) return false;
    this.queue.push(turn);
    this.lastQueued = turn.tick;
    this.clock = noteArrival(this.clock, turn.tick, now);
    return true;
  }

  /** Returns the number of turns stepped. */
  update(now: number): number {
    this.clock = advance(this.clock, now, this.lastQueued);
    const due = dueTick(this.clock);
    let n = 0;
    while (this.queue.length > 0 && this.queue[0]!.tick <= due) {
      this.stepOne();
      n++;
    }
    return n;
  }

  /** 0..1 progress through the current turn. */
  alpha(now: number): number {
    return progress(advance(this.clock, now, this.lastQueued), this.world.tick);
  }

  private stepOne(): void {
    const turn = this.queue.shift()!;
    this.recordPrev();
    this.deps.step(this.sim, turn.intents);
    this.seedLaunched();
    this.terrainWatch.note(this.sim.terrainDirty);
    if (turn.tick % HASH_EVERY === 0) this.deps.onHash(turn.tick, this.deps.hash(this.world));
  }

  private recordPrev(): void {
    const gen = ++this.gen;
    this.recordUnits(gen);
    this.recordShots(gen);
  }

  private recordUnits(gen: number): void {
    for (const u of this.world.units) {
      const p = this.prev.get(u.id);
      if (p) {
        p.x = u.x;
        p.y = u.y;
        p.facing = u.facing;
        p.aim = u.aim;
        p.elevation = u.elevation;
        p.gen = gen;
      } else {
        this.prev.set(u.id, { x: u.x, y: u.y, facing: u.facing, aim: u.aim, elevation: u.elevation, gen });
      }
    }
    for (const [id, p] of this.prev) if (p.gen !== gen) this.prev.delete(id);
  }

  private recordShots(gen: number): void {
    for (const s of this.world.projectiles) {
      const p = this.prevShots.get(s.id);
      if (p) {
        p.x = s.x;
        p.y = s.y;
        p.z = s.z;
        p.gen = gen;
      } else {
        this.prevShots.set(s.id, { x: s.x, y: s.y, z: s.z, gen });
      }
    }
    for (const [id, p] of this.prevShots) if (p.gen !== gen) this.prevShots.delete(id);
  }

  /** A shell launched this step starts its draw at the launch point, not one tick of flight out. */
  private seedLaunched(): void {
    for (const s of this.world.projectiles) {
      if (!this.prevShots.has(s.id)) this.prevShots.set(s.id, { ...launchPoint(s), gen: this.gen });
    }
  }
}
