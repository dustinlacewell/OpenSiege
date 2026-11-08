import { UNIT_STATS, weaponOf, type MapSize } from "@mf/sim";
import { ghostPower, unitPower } from "../assess/power.ts";
import { reachOf } from "../assess/threat.ts";
import type { Hurt, Loss } from "../board/hurt.ts";
import type { DangerKnobs } from "../knobs.ts";
import { MIN_REACH } from "../memory/explored.ts";
import type { Ghost } from "../memory/memory.ts";
import type { Eye } from "../perception/picture.ts";
import { cellCentre, emptyGrid, fade, stamp, type DangerGrid } from "./grid.ts";

/** A forgotten ghost leaves this share of its power as sight scar. */
const SIGHT_SHARE = 0.5;
/** Damage and loss scar spread this far around the hurt unit: artillery range. */
const UNSEEN_REACH = 2200;
/** One unseen artillery gun, sieged. Damage with no seen shooter is counted in these. */
const GUN = weaponOf({ kind: "artillery", mode: "sieged" })!;
const GUN_RATE = GUN.damage / GUN.reload;
const GUN_POWER = unitPower("artillery", "sieged", UNIT_STATS.artillery.maxHp);

/** Enemy power the bot cannot see now but has reason to expect. Kept in memory; fades each think. */
export interface Scar {
  sight: DangerGrid;
  damage: DangerGrid;
  loss: DangerGrid;
}

/** What one think adds to or clears from the scar. Events here are past the reaction delay. */
export interface ScarInputs {
  /** Ghosts memory dropped this think. */
  forgotten: readonly Ghost[];
  /** Ghosts old enough to react to. A hurt unit within one's reach had a seen shooter. */
  known: readonly Ghost[];
  hurts: readonly Hurt[];
  losses: readonly Loss[];
  eyes: readonly Eye[];
  live: DangerGrid;
}

export function emptyScar(m: MapSize): Scar {
  return { sight: emptyGrid(m), damage: emptyGrid(m), loss: emptyGrid(m) };
}

/** Fade, add sightings, unseen damage and losses, then clear sight scar where own eyes see no live danger. */
export function updateScar(scar: Scar, inputs: ScarInputs, knobs: DangerKnobs, ticksSince: number): Scar {
  const out = fadeScar(scar, knobs, ticksSince);
  addSightings(out.sight, inputs.forgotten);
  addUnseenDamage(out.damage, inputs.hurts, inputs.known);
  addLosses(out.loss, inputs.losses);
  clearSeen(out.sight, inputs.eyes, inputs.live);
  return out;
}

function fadeScar(scar: Scar, k: DangerKnobs, ticks: number): Scar {
  const by = (halfLife: number): number => 0.5 ** (ticks / halfLife);
  return { sight: fade(scar.sight, by(k.sightHalfLife)), damage: fade(scar.damage, by(k.damageHalfLife)), loss: fade(scar.loss, by(k.lossHalfLife)) };
}

function addSightings(grid: DangerGrid, forgotten: readonly Ghost[]): void {
  for (const g of forgotten) stamp(grid, g.x, g.y, SIGHT_SHARE * ghostPower(g), reachOf(g));
}

function addUnseenDamage(grid: DangerGrid, hurts: readonly Hurt[], known: readonly Ghost[]): void {
  for (const h of hurts) if (!seenShooter(h, known)) stamp(grid, h.x, h.y, shooterPower(h.rate), UNSEEN_REACH);
}

function addLosses(grid: DangerGrid, losses: readonly Loss[]): void {
  for (const l of losses) stamp(grid, l.x, l.y, l.rate > 0 ? shooterPower(l.rate) : GUN_POWER, UNSEEN_REACH);
}

/** Some known armed ghost could hit the hurt unit. */
function seenShooter(h: Hurt, known: readonly Ghost[]): boolean {
  return known.some((g) => ghostPower(g) > 0 && (g.x - h.x) ** 2 + (g.y - h.y) ** 2 <= reachOf(g) ** 2);
}

/** Power of unseen guns that would deal `rate` hp per tick. */
export function shooterPower(rate: number): number {
  return GUN_POWER * (rate / GUN_RATE);
}

/** Cells some own eye sees, with no live danger, lose their sight scar. Same reach rule as explored cells. */
function clearSeen(sight: DangerGrid, eyes: readonly Eye[], live: DangerGrid): void {
  for (const e of eyes) {
    const reach = Math.max(e.sight, MIN_REACH);
    const lo = (v: number): number => Math.max(0, Math.floor((v - reach) / sight.cell));
    const hiX = Math.min(sight.cols - 1, Math.floor((e.x + reach) / sight.cell));
    const hiY = Math.min(sight.rows - 1, Math.floor((e.y + reach) / sight.cell));
    for (let j = lo(e.y); j <= hiY; j++) {
      for (let i = lo(e.x); i <= hiX; i++) {
        const c = cellCentre(i, j);
        const n = j * sight.cols + i;
        if ((c.x - e.x) ** 2 + (c.y - e.y) ** 2 <= reach * reach && live.values[n] === 0) sight.values[n] = 0;
      }
    }
  }
}
