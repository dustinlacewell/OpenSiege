import type { ResourceField, Terrain, World } from "@mf/sim";

/** Hand-made test maps: 5000 x 5000, terrain cell 125, so 41 x 41 vertices. */
export const SIDE = 5000;
const CELL = 125;
const VERTS = SIDE / CELL + 1;

/** A terrain whose vertex heights come from `h(x, y)` in world units. */
export function terrainOf(h: (x: number, y: number) => number): Terrain {
  const heights: number[] = [];
  for (let j = 0; j < VERTS; j++) for (let i = 0; i < VERTS; i++) heights.push(Math.round(h(i * CELL, j * CELL)));
  return { cols: VERTS, rows: VERTS, cell: CELL, heights, seaLevel: -1 };
}

/** A bare world on the terrain with a field of 1000 credits at each point. No units, no features. */
export function worldOf(terrain: Terrain, fields: readonly { x: number; y: number }[]): World {
  const fs: ResourceField[] = fields.map((f, n) => ({ id: n + 1, x: f.x, y: f.y, radius: 200, amount: 1000 }));
  return { tick: 0, rng: 1, nextId: 1, players: [], units: [], fields: fs, features: [], projectiles: [], blasts: [], terrain, dug: [] };
}

/** A wall of height 900 along x 2375..2625 over the whole map, except an open gap at y 2250..2750 (`GAP`). */
export const GAP = { x: 2500, y: 2500 };
export function wallWithGap(x: number, y: number): number {
  const inWall = x >= 2375 && x <= 2625;
  const inGap = y >= 2250 && y <= 2875;
  return inWall && !inGap ? 900 : 0;
}

/** A ridge running north-south: crest 300 high at x = `RIDGE_X`, falling 30 per 100 to flat ground. */
export const RIDGE_X = 1500;
export function ridge(x: number): number {
  return Math.max(0, 300 - Math.abs(x - RIDGE_X) * 0.3);
}
