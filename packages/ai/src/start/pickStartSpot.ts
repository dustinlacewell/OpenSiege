import { createWorld, goodSpawnSpot, inWater, mapCentre, mapDiagonal, spawnEdge, type MapSize, type MapSpec, type World } from "@mf/sim";
import { seededRoll } from "../rng.ts";

// Where a bot puts its factory before the round. Pure: the map, the spots taken so far, the knobs and a seed.
// Rich ground near the spot is good. So is distance from the nearest enemy spot.
// No spot comes closer than a minimum gap to any taken spot, ally or enemy, so factories never stack.

export interface Spot { x: number; y: number }

/** A spot already chosen, with the chooser's team. */
export interface TakenSpot extends Spot { team: number }

export interface StartKnobs {
  /** 0..1. How much field wealth counts against distance from enemies. */
  wealthWeight: number;
  /** The pick is a seeded roll among this many best candidates. 1 always takes the best. */
  topN: number;
}

/** A field counts toward a spot's wealth out to this distance, less with distance. */
export const REACH = 3000;
/** Ring candidates stand this far outside a field's edge. */
const RING_GAP = 300;
const RING_POINTS = 8;
/** The minimum gap halves while no candidate clears it, but never below this. */
export const MIN_GAP_FLOOR = 600;
/** The fallback scans this many points on each axis inside the spawn clamp. */
const GRID_POINTS = 16;

export function pickStartSpot(spec: MapSpec, taken: readonly TakenSpot[], me: { team: number }, knobs: StartKnobs, seed: number): Spot {
  const world = createWorld(spec);
  const candidates = spreadOut(candidatesOf(spec).filter((c) => usable(world, spec, c)), taken, minGap(spec));
  if (candidates.length === 0) return fallback(world, spec, taken);
  const ranked = rank(spec, candidates, taken.filter((t) => t.team !== me.team), knobs.wealthWeight);
  const top = ranked.slice(0, Math.max(1, knobs.topN));
  return top[Math.floor(seededRoll(seed)() * top.length)]!;
}

/** The first gap tried: 2500, or a sixth of the diagonal on a larger map. */
export function minGap(m: MapSize): number {
  return Math.max(2500, mapDiagonal(m) / 6);
}

/** The candidates at least `gap` from every taken spot. While none clears it, the gap halves, down to MIN_GAP_FLOOR. */
function spreadOut(candidates: readonly Spot[], taken: readonly Spot[], gap: number): Spot[] {
  for (let g = gap; ; g = Math.max(MIN_GAP_FLOOR, g / 2)) {
    const kept = candidates.filter((c) => nearest(taken, c, Infinity) >= g);
    if (kept.length > 0 || g <= MIN_GAP_FLOOR) return kept;
  }
}

/** The usable grid point farthest from every taken spot; ties go to the one nearest the centre. With none usable, the centre. */
function fallback(world: World, m: MapSize, taken: readonly Spot[]): Spot {
  const centre = mapCentre(m), diagonal = mapDiagonal(m);
  const scored = gridOf(m).filter((c) => usable(world, m, c)).map((c) => ({
    c, gap: nearest(taken, c, diagonal), off: Math.hypot(c.x - centre.x, c.y - centre.y),
  }));
  scored.sort((a, b) => b.gap - a.gap || a.off - b.off);
  return scored[0]?.c ?? centre;
}

/** GRID_POINTS x GRID_POINTS integer points spread over the spawn clamp, corners included. */
function gridOf(m: MapSize): Spot[] {
  const edge = spawnEdge(m), step = (side: number) => (side - 2 * edge) / (GRID_POINTS - 1);
  return Array.from({ length: GRID_POINTS * GRID_POINTS }, (_, k) => ({
    x: Math.round(edge + (k % GRID_POINTS) * step(m.width)),
    y: Math.round(edge + Math.floor(k / GRID_POINTS) * step(m.height)),
  }));
}

/** Each field centre, plus RING_POINTS around it at radius + RING_GAP. Rounded to integers. */
function candidatesOf(spec: MapSpec): Spot[] {
  return spec.fields.flatMap((f) => [
    { x: f.x, y: f.y },
    ...Array.from({ length: RING_POINTS }, (_, k) => {
      const a = (k / RING_POINTS) * 2 * Math.PI, r = f.radius + RING_GAP;
      return { x: Math.round(f.x + r * Math.cos(a)), y: Math.round(f.y + r * Math.sin(a)) };
    }),
  ]);
}

/** Inside the spawn clamp, on dry land, and a spot the sim's spawn picker rates best (clear and flat). */
function usable(world: World, m: MapSize, c: Spot): boolean {
  const edge = spawnEdge(m);
  const inside = c.x >= edge && c.x <= m.width - edge && c.y >= edge && c.y <= m.height - edge;
  return inside && !inWater(world.terrain, c.x, c.y) && goodSpawnSpot(world, c.x, c.y);
}

/** Best first. Wealth and enemy gap are each scaled to 0..1, then weighed. */
function rank(spec: MapSpec, candidates: readonly Spot[], enemies: readonly Spot[], wealthWeight: number): Spot[] {
  const diagonal = mapDiagonal(spec);
  const scored = candidates.map((c) => ({ c, wealth: wealth(spec, c), gap: nearest(enemies, c, diagonal) }));
  const maxWealth = Math.max(...scored.map((s) => s.wealth)) || 1;
  const score = (s: (typeof scored)[number]) => wealthWeight * (s.wealth / maxWealth) + (1 - wealthWeight) * (s.gap / diagonal);
  return scored.sort((a, b) => score(b) - score(a)).map((s) => s.c);
}

/** Field credits near the spot: each field's amount, falling to 0 at REACH. */
function wealth(spec: MapSpec, c: Spot): number {
  return spec.fields.reduce((sum, f) => sum + f.amount * Math.max(0, 1 - Math.hypot(f.x - c.x, f.y - c.y) / REACH), 0);
}

/** Distance from `c` to the nearest of `spots`, capped at `cap`. With none, `cap`. */
function nearest(spots: readonly Spot[], c: Spot, cap: number): number {
  return spots.reduce((min, e) => Math.min(min, Math.hypot(e.x - c.x, e.y - c.y)), cap);
}
