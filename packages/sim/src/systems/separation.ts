import { UNIT_STATS } from "../stats.ts";
import { isqrt } from "../math.ts";
import { clampX, clampY } from "../mapSize.ts";
import { MAX_RADIUS } from "../units.ts";
import { slide } from "../nav/slide.ts";
import type { NavState } from "../nav/navState.ts";
import type { SimState } from "../simState.ts";
import type { Grid } from "../grid.ts";
import type { MapSize, Unit } from "../types.ts";

/** Percent of an overlap the idle unit takes when a moving unit runs into it. */
const IDLE_SHARE = 80;
/** Least push budget per tick, for slow units. */
const MIN_PUSH = 4;

/** anchor: any siege mode, never moves. moving: mobile with a move or attack order. idle: mobile, no order. */
type Role = "anchor" | "moving" | "idle";

/**
 * Soft push between overlapping pairs, in (i, j > i) index order.
 * Moving units shove idle ones aside; equals split the overlap; anchors never move.
 * Each unit moves at most half its speed per tick from pushes, so overlaps ease out over ticks.
 * A push never moves a unit into a blocked cell of its class (`nav/slide.ts`).
 */
export function separation(state: SimState, grid: Grid, m: MapSize): void {
  const near: number[] = [];
  const units = state.world.units;
  const nav = state.nav;
  const budget = units.map(pushBudget);
  for (let i = 0; i < units.length; i++) {
    const a = units[i]!;
    const ra = UNIT_STATS[a.kind].radius;
    for (const j of grid.query(a.x, a.y, ra + MAX_RADIUS, near)) {
      if (j > i) separate(nav, m, a, units[j]!, ra, budget, i, j);
    }
  }
}

function pushBudget(u: Unit): number {
  return Math.max(MIN_PUSH, Math.floor(UNIT_STATS[u.kind].speed / 2));
}

function roleOf(u: Unit): Role {
  if (u.mode !== "mobile") return "anchor";
  return u.orders.length === 0 ? "idle" : "moving";
}

/** Percent of the overlap that b takes; a takes the rest. */
function shareOfB(a: Role, b: Role): number {
  if (a === "anchor") return b === "anchor" ? 0 : 100;
  if (b === "anchor") return 0;
  if (a === b) return 50;
  return b === "idle" ? IDLE_SHARE : 100 - IDLE_SHARE;
}

function separate(nav: NavState, m: MapSize, a: Unit, b: Unit, ra: number, budget: number[], i: number, j: number): void {
  const reach = ra + UNIT_STATS[b.kind].radius;
  let dx = b.x - a.x, dy = b.y - a.y;
  const d2 = dx * dx + dy * dy;
  if (d2 >= reach * reach) return;
  const roleA = roleOf(a), roleB = roleOf(b);
  if (roleA === "anchor" && roleB === "anchor") return;
  let d = isqrt(d2);
  if (d === 0) { dx = 1; dy = 0; d = 1; } // Stacked exactly: split along +x, b goes right.
  const overlap = reach - d;
  const bShare = Math.floor((overlap * shareOfB(roleA, roleB)) / 100);
  push(nav, m, b, dx, dy, d, spend(budget, j, bShare));
  push(nav, m, a, -dx, -dy, d, spend(budget, i, overlap - bShare));
}

/** Take up to `amount` from unit k's push budget for this tick. */
function spend(budget: number[], k: number, amount: number): number {
  const used = Math.min(amount, budget[k]!);
  if (used <= 0) return 0;
  budget[k] = budget[k]! - used;
  return used;
}

function push(nav: NavState, m: MapSize, u: Unit, dx: number, dy: number, d: number, amount: number): void {
  if (amount <= 0 || u.mode !== "mobile") return;
  const toX = clampX(m, u.x + Math.trunc((dx * amount) / d));
  const toY = clampY(m, u.y + Math.trunc((dy * amount) / d));
  const p = slide(nav.shape, nav.grids[UNIT_STATS[u.kind].moveClass], u.x, u.y, toX, toY);
  u.x = p.x;
  u.y = p.y;
}
