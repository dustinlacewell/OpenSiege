import { buildGrid, clampX, clampY, detect, heightAt, mapSize, sameTeam, UNIT_STATS, type Level, type MapSize, type Player, type Terrain, type Unit, type VertexBox, type World } from "@mf/sim";
import { radarOffset, type Spot } from "./radarSpot.ts";
import { SightGrid } from "./sightGrid.ts";

/** What the local player knows of a unit: the sim's detection level. */
export type { Level };

/** Owner ids that share vision with `me`: `me` and every player on its team. A `me` that is no player (the pick scene) has no team. */
export function alliedOwners(players: readonly Player[], me: number, out: Set<number> = new Set()): Set<number> {
  out.clear();
  out.add(me);
  if (!players.some((p) => p.id === me)) return out;
  for (const p of players) if (sameTeam(players, me, p.id)) out.add(p.id);
  return out;
}

/**
 * The local player's fog of war: the one query seam for what is shown. Display only: lockstep gives
 * every client the whole world, so this hides things, it does not protect them. Terrain is never hidden.
 * Rebuilt once per sim step: ground fog from own and allied units' `sight` (hills block), unit levels from the sim's `detect`.
 */
export class Vision {
  /** Show the whole map (dead player, spectator). Off by default. */
  revealAll = false;
  private readonly grid = new SightGrid();
  /** Enemy id → level, for enemies that are not "none". */
  private readonly levels = new Map<number, Level>();
  private readonly contacts: Unit[] = [];
  private readonly viewers: Unit[] = [];
  private eyes = new Float64Array(64);
  private world: World | null = null;
  private map: MapSize = { width: 0, height: 0 };
  private tick = -1;
  private me = -1;
  /** `me` and its teammates: their units give sight and their things always draw. */
  private readonly allies = new Set<number>();
  private revealed = false;
  private time = 0;

  /** Call each frame with seconds. Rebuilds only when the sim stepped, the world or player changed, or `revealAll` flipped. */
  update(world: World, me: number, time: number): void {
    this.time = time;
    if (world === this.world && world.tick === this.tick && me === this.me && this.revealAll === this.revealed) return;
    this.world = world;
    this.tick = world.tick;
    this.me = me;
    this.revealed = this.revealAll;
    this.map = mapSize(world.terrain);
    this.grid.useTerrain(world.terrain);
    alliedOwners(world.players, me, this.allies);
    this.findViewers(world);
    this.light();
    this.classify(world);
  }

  /** The heights in this vertex box changed in place. Re-reads the ground and forces the next `update` to recompute. */
  refresh(terrain: Terrain, box: VertexBox): void {
    this.grid.refresh(terrain, box);
    this.tick = -1;
  }

  /** What the local player knows of this unit. Own and allied units are always seen. */
  level(u: Unit): Level {
    if (this.allies.has(u.owner) || this.revealAll) return "seen";
    return this.levels.get(u.id) ?? "none";
  }

  /** Draw it as a unit and let it pick? Same as `level(u) === "seen"`. */
  shows(u: Unit): boolean {
    return this.level(u) === "seen";
  }

  /** Is this world point (a little above ground) in the local player's line of sight now? */
  sees(x: number, y: number): boolean {
    return this.revealAll || this.grid.sees(x, y);
  }

  /** Draw a thing owned by `owner` at this world point? Own and allied things always; others only where seen. */
  showsAt(owner: number, x: number, y: number): boolean {
    return this.allies.has(owner) || this.sees(x, y);
  }

  /** Enemies at level "radar", in world order. Reused: valid until the next update. */
  radarContacts(): readonly Unit[] {
    return this.contacts;
  }

  /** Writes where a radar contact's dot is now into `out`: the true place plus a slowly drifting offset. */
  radarSpot(u: Unit, out: Spot): Spot {
    radarOffset(u.id, this.time, out);
    out.x = clampX(this.map, u.x + out.x);
    out.y = clampY(this.map, u.y + out.y);
    return out;
  }

  /** Own and allied units and their eye heights (ground + model height). */
  private findViewers(world: World): void {
    const viewers = this.viewers;
    viewers.length = 0;
    for (const u of world.units) if (this.allies.has(u.owner)) viewers.push(u);
    if (this.eyes.length < viewers.length) this.eyes = new Float64Array(viewers.length * 2);
    for (let i = 0; i < viewers.length; i++) {
      const v = viewers[i]!;
      this.eyes[i] = heightAt(world.terrain, v.x, v.y) + UNIT_STATS[v.kind].height;
    }
  }

  private light(): void {
    this.grid.fill(this.revealAll);
    if (this.revealAll) return;
    for (let i = 0; i < this.viewers.length; i++) {
      const v = this.viewers[i]!;
      this.grid.mark(v.x, v.y, this.eyes[i]!, UNIT_STATS[v.kind].sight);
    }
  }

  /** Per non-allied unit, the sim's detection level for the local player's team. */
  private classify(world: World): void {
    this.levels.clear();
    this.contacts.length = 0;
    if (this.revealAll) return;
    const detection = detect(world, buildGrid(world.units, this.map));
    for (const e of world.units) {
      if (this.allies.has(e.owner)) continue;
      const lvl = detection.level(this.me, e);
      if (lvl === "none") continue;
      this.levels.set(e.id, lvl);
      if (lvl === "radar") this.contacts.push(e);
    }
  }
}
