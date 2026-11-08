import { TICK_MS } from "@mf/sim";

/**
 * Jitter-buffered playout clock. Pure: every function takes state and `now`, returns new state.
 * `time` is sim time in ms; turn `t` is due once `time >= t * TICK_MS`.
 */
export interface Playout {
  readonly time: number;
  readonly lastNow: number;
  readonly rate: number;
  readonly arrivals: readonly Arrival[];
  readonly jitter: number;
}

interface Arrival {
  readonly at: number;
  readonly offset: number;
}

const WINDOW_MS = 2000;
const JITTER_EWMA = 0.1;
const MIN_PAD_MS = 20;
const MAX_PAD_MS = 250;
const MAX_RATE_DEV = 0.08;
const GAIN = 0.0005;
const RESET_MS = 4 * TICK_MS;

export function startPlayout(tick: number, now: number): Playout {
  return { time: tick * TICK_MS, lastNow: now, rate: 1, arrivals: [], jitter: 0 };
}

/** Records that turn `tick` arrived at `now`. */
export function noteArrival(p: Playout, tick: number, now: number): Playout {
  const offset = now - tick * TICK_MS;
  const arrivals = [...p.arrivals.filter((a) => now - a.at <= WINDOW_MS), { at: now, offset }];
  const spread = offset - baseOf(arrivals);
  const jitter = p.arrivals.length === 0 ? spread : p.jitter + JITTER_EWMA * (spread - p.jitter);
  return { ...p, arrivals, jitter };
}

/** Advances the clock to `now`, never past the end of the last received turn. */
export function advance(p: Playout, now: number, lastReceived: number): Playout {
  const cap = (lastReceived + 1) * TICK_MS;
  if (p.arrivals.length === 0) return { ...p, lastNow: now };
  const error = targetOf(p, now) - p.time;
  if (error > RESET_MS) return { ...p, time: Math.min(cap, targetOf(p, now)), lastNow: now, rate: 1 };
  const rate = 1 + clamp(error * GAIN, -MAX_RATE_DEV, MAX_RATE_DEV);
  const time = Math.min(cap, p.time + (now - p.lastNow) * rate);
  return { ...p, time: Math.max(p.time, time), lastNow: now, rate };
}

/** Highest tick that is due. */
export function dueTick(p: Playout): number {
  return Math.floor(p.time / TICK_MS);
}

/** 0..1 progress past the last stepped tick. */
export function progress(p: Playout, steppedTick: number): number {
  return clamp((p.time - steppedTick * TICK_MS) / TICK_MS, 0, 1);
}

export function delayOf(p: Playout): number {
  return TICK_MS + clamp(2.5 * p.jitter, MIN_PAD_MS, MAX_PAD_MS);
}

function targetOf(p: Playout, now: number): number {
  return now - baseOf(p.arrivals) - delayOf(p);
}

function baseOf(arrivals: readonly Arrival[]): number {
  let min = Infinity;
  for (const a of arrivals) min = Math.min(min, a.offset);
  return min;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}
