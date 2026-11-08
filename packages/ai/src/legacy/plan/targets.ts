import { mapDiagonal, type MapSize } from "@mf/sim";
import type { EnemyGroup } from "../assess/groups.ts";
import { ghostsWithin } from "../assess/power.ts";
import { threatAt } from "../assess/threat.ts";
import { dist, mirror, type Point } from "../geometry.ts";
import { scoutCells } from "../memory/explored.ts";
import type { Plan } from "./plan.ts";

/** Enemy power within this of a target counts against an attack on it. */
export const TARGET_REACH = 1500;
/** Distance scale in the target score: a quarter of the short side. */
const targetNear = (m: MapSize): number => Math.min(m.width, m.height) / 4;
/** Ticks after which a seen cell is as stale as an unseen one. */
const STALE = 3000;
/** Weight of the guess that the enemy starts across the map. */
const MIRROR_PULL = 1.5;
const JITTER = 0.3;

/** Enemy power a force at the point must face: the ghosts within `r`, or the threat that reaches it (long-range guns), whichever is more. */
export function enemyPowerAt(p: Plan, at: Point, r: number): number {
  return Math.max(ghostsWithin(p.known, at, r), threatAt(p.threat, at));
}

/** The best enemy group that a force of `power` beats by ratio `k`. */
export function pickTarget(p: Plan, from: Point, power: number, k: number): EnemyGroup | undefined {
  let best: EnemyGroup | undefined;
  let bestScore = 0;
  const near = targetNear(p.pic.map);
  for (const g of p.groups) {
    if (power < k * enemyPowerAt(p, g.at, TARGET_REACH)) continue;
    const score = g.value / (1 + dist(from, g.at) / near);
    if (score > bestScore) {
      bestScore = score;
      best = g;
    }
  }
  return best;
}

/** A stale scout cell, far from home and toward the far side of the map, not too far from `from`. */
export function scoutPoint(p: Plan, from: Point): Point {
  const guess = mirror(p.home.site, p.pic.map);
  const span = mapDiagonal(p.pic.map);
  let best: Point = guess;
  let bestScore = -Infinity;
  for (const c of scoutCells(p.mem.explored)) {
    const stale = c.seen < 0 ? 1 : Math.min(1, (p.pic.tick - c.seen) / STALE);
    const score = stale * (1 + dist(p.home.site, c.at) / span) - MIRROR_PULL * dist(guess, c.at) / span - dist(from, c.at) / (2 * span) + JITTER * p.roll();
    if (score > bestScore) {
      bestScore = score;
      best = c.at;
    }
  }
  return best;
}
