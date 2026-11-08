import { MAX_QUEUE, TICK_MS, UNIT_STATS, workRateOf, type BuildJob, type Unit, type UnitKind, type UnitMode } from "@mf/sim";

/** Factory rows that fit the queue band before "+N more". */
export const MAX_ROWS = 2;
/** Tiles after the head job in one row. When the runs do not fit, the last one shows "+N". */
export const NEXT_TILES = 8;

/** The job in progress. */
export interface HeadTile {
  /** Job id. Cancelling the tile cancels this job. */
  job: number;
  kind: UnitKind;
  /** 0..100. */
  pct: number;
}

/** A run of queued jobs of one kind, in queue order. */
export interface RunTile {
  kind: UnitKind;
  count: number;
  /** Job ids of the run, in queue order. Cancelling the tile cancels from the end. */
  jobs: number[];
}

export interface FactoryQueue {
  id: number;
  /** null when the queue is empty. */
  head: HeadTile | null;
  /** The jobs after the head, grouped into runs. At most NEXT_TILES, one less when `rest` > 0. */
  next: RunTile[];
  /** Jobs in the runs that did not fit. The last tile shows "+N". */
  rest: number;
  mode: UnitMode;
  /** Progress per tick for the head job at the current mode. 0 = paused. */
  rate: number;
  /** True when the current rate is below the sieged rate. */
  slow: boolean;
  /** Seconds until the head job ends at the current rate. null when paused or idle. */
  secondsLeft: number | null;
}

export interface QueueSummary {
  rows: FactoryQueue[];
  /** Selected factories beyond MAX_ROWS. */
  more: number;
  /** True when no selected factory can take another job. */
  full: boolean;
}

export function queueSummary(factories: readonly Unit[]): QueueSummary {
  return {
    rows: factories.slice(0, MAX_ROWS).map(factoryQueue),
    more: Math.max(0, factories.length - MAX_ROWS),
    full: factories.length > 0 && factories.every((f) => f.queue.length >= MAX_QUEUE),
  };
}

function factoryQueue(f: Unit): FactoryQueue {
  const rate = workRateOf(f);
  const first = f.queue[0];
  const { next, rest } = fitRuns(runsOf(f.queue, 1));
  return {
    id: f.id,
    head: first ? { job: first.id, kind: first.kind, pct: headPercent(first.kind, first.progress) } : null,
    next,
    rest,
    mode: f.mode,
    rate,
    slow: rate < UNIT_STATS.factory.siegeWorkRate,
    secondsLeft: secondsLeft(f, rate),
  };
}

/** Jobs from `from` on, with neighbours of the same kind merged into one run. */
export function runsOf(queue: readonly BuildJob[], from: number): RunTile[] {
  const out: RunTile[] = [];
  for (let i = from; i < queue.length; i++) {
    const { id, kind } = queue[i]!;
    const last = out[out.length - 1];
    if (last && last.kind === kind) {
      last.count++;
      last.jobs.push(id);
    } else out.push({ kind, count: 1, jobs: [id] });
  }
  return out;
}

/** All runs when they fit; else the first NEXT_TILES - 1 and the job count of the others. */
function fitRuns(runs: RunTile[]): { next: RunTile[]; rest: number } {
  if (runs.length <= NEXT_TILES) return { next: runs, rest: 0 };
  const next = runs.slice(0, NEXT_TILES - 1);
  return { next, rest: runs.slice(NEXT_TILES - 1).reduce((n, r) => n + r.count, 0) };
}

function headPercent(kind: UnitKind, progress: number): number {
  return Math.min(100, Math.floor((progress / UNIT_STATS[kind].buildTicks) * 100));
}

function secondsLeft(f: Unit, rate: number): number | null {
  const head = f.queue[0];
  if (!head || rate <= 0) return null;
  const ticks = Math.max(0, UNIT_STATS[head.kind].buildTicks - head.progress);
  return Math.ceil((ticks / rate) * TICK_MS / 1000);
}
