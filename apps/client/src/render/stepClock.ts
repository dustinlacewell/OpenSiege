/** Longest frame gap the clock accepts, seconds. A stall does not replay. */
const MAX_FRAME = 0.1;

/** What one frame advances: real seconds since the last frame, and fixed steps to run. */
export interface ClockTick {
  dt: number;
  steps: number;
}

/**
 * Pure. A fixed-rate step accumulator off a seconds clock. The first call runs no step.
 * At most `maxSteps` per frame; time past that is dropped, so a slow frame slows the waves instead of piling up.
 */
export class StepClock {
  private last = -1;
  private acc = 0;
  private readonly tick: ClockTick = { dt: 0, steps: 0 };

  constructor(readonly hz: number, readonly maxSteps: number) {}

  /** Reused: valid until the next call. */
  advance(time: number): ClockTick {
    const dt = this.last < 0 ? 0 : Math.min(MAX_FRAME, Math.max(0, time - this.last));
    this.last = time;
    this.acc += dt * this.hz;
    const steps = Math.min(this.maxSteps, Math.floor(this.acc));
    this.acc = Math.min(this.acc - steps, 1);
    this.tick.dt = dt;
    this.tick.steps = steps;
    return this.tick;
  }
}
