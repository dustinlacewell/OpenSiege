import { heightAt } from "./terrain.ts";
import type { Terrain } from "./types.ts";

/** Grade in percent (rise·100/run) at which uphill speed bottoms out and downhill speed tops out. */
const STEEP_GRADE = 40;
const DOWNHILL_MAX_PCT = 115;

/** Speed for a step from (x, y) along (dx, dy), length d, scaled by the grade of that step. `uphillMinPct` is the class's floor uphill. */
export function slopeSpeed(t: Terrain, x: number, y: number, dx: number, dy: number, d: number, speed: number, uphillMinPct: number): number {
  if (d === 0 || speed === 0) return speed;
  const run = Math.min(d, speed);
  const rise = heightAt(t, x + Math.trunc((dx * run) / d), y + Math.trunc((dy * run) / d)) - heightAt(t, x, y);
  const pct = speedPct(Math.floor((rise * 100) / run), uphillMinPct);
  return Math.max(1, Math.floor((speed * pct) / 100));
}

function speedPct(grade: number, uphillMinPct: number): number {
  if (grade >= 0) return Math.max(uphillMinPct, 100 - Math.floor((grade * (100 - uphillMinPct)) / STEEP_GRADE));
  return Math.min(DOWNHILL_MAX_PCT, 100 + Math.floor((-grade * (DOWNHILL_MAX_PCT - 100)) / STEEP_GRADE));
}
