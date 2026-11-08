import { UNIT_STATS, type World } from "@mf/sim";

/** One leaderboard line. */
export interface LeaderRow {
  /** The player id. */
  id: number;
  name: string;
  color: number;
  credits: number;
  factories: number;
  harvesters: number;
  /** Total cost of the armed units. */
  power: number;
  me: boolean;
}

const LEADERS = 8;

/** Connected players, strongest military first. */
export function leaders(world: World, me: number): LeaderRow[] {
  const rows = new Map<number, LeaderRow>();
  for (const p of world.players) {
    if (p.connected) rows.set(p.id, { id: p.id, name: p.name, color: p.color, credits: p.credits, factories: 0, harvesters: 0, power: 0, me: p.id === me });
  }
  for (const u of world.units) {
    const row = rows.get(u.owner);
    if (!row) continue;
    if (u.kind === "factory") row.factories++;
    else if (u.kind === "harvester") row.harvesters++;
    if (UNIT_STATS[u.kind].weapon !== "none") row.power += UNIT_STATS[u.kind].cost;
  }
  return [...rows.values()].sort((a, b) => b.power - a.power).slice(0, LEADERS);
}
