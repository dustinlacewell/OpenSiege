// The whole game state. Plain data only: it must survive JSON round-trips
// and hash the same on every machine. All numbers are integers.

export type UnitKind = "factory" | "harvester" | "engineer" | "radar" | "jammer" | "tank" | "artillery" | "mine";

/** mobile → deploying → sieged → packing → mobile. Timers count down in ticks. */
export type UnitMode = "mobile" | "deploying" | "sieged" | "packing";

export type Order =
  /**
   * `group` is shared by every unit that got this order together. Units of a factory's rally share the factory id.
   * `attack`: an armed unit engages enemies near its route (`systems/engage.ts`), then drives on.
   * `x, y` is the unit's own spot.
   * `path`: waypoints still to pass, the last the spot to stop at (`nav/plan.ts`). Empty until the order is first
   * driven; the unit plans it then and drops each waypoint as it passes.
   * `best`, `stall`: the shortest path length left so far, and the ticks since it last fell. When the ticks run out the unit plans again and the count starts over.
   * `skip`: id of one enemy the attack-move search ignores, 0 = none. Set when an engage ends on its leash.
   */
  | { type: "move"; x: number; y: number; group: number; attack: boolean; path: { x: number; y: number }[]; best: number; stall: number; skip: number }
  /**
   * Close on the target until in firing position; done when it dies. `hold`: the hull is stopped in firing position.
   * `x, y`: where the unit's team last detected the target. Set when given; kept current while the order is the head (`systems/lostTargets.ts`).
   */
  | { type: "attack"; target: number; hold: boolean; x: number; y: number }
  /**
   * A temporary attack an attack-move puts in front of itself (`systems/engage.ts`). Ends on the target's death,
   * escape, or the leash. `target`, `hold`: as for attack. `x, y`: the anchor, the unit's position when the engage started.
   */
  | { type: "engage"; target: number; hold: boolean; x: number; y: number }
  /** Done once the unit is sieged (on) or mobile (off). */
  | { type: "siege"; on: boolean }
  /** Stay near the target unit; done when it dies. `chase` is true while driving back inside the leash. */
  | { type: "guard"; target: number; chase: boolean }
  /** Engineer only: take hp off the scrap feature `target` for credits (`reclaim.ts`). Done when the scrap is gone. */
  | { type: "reclaim"; target: number };

export type MoveOrder = Extract<Order, { type: "move" }>;

export interface BuildJob {
  /** From `world.nextId` when queued. `cancel` names jobs by it. */
  id: number;
  kind: UnitKind;
  /** Ticks of work done. Done when it reaches UNIT_STATS[kind].buildTicks. */
  progress: number;
}

export interface Unit {
  id: number;
  owner: number;
  kind: UnitKind;
  x: number;
  y: number;
  /** Facing in angle steps, 0..ANGLE_STEPS-1. Cosmetic, but deterministic. */
  facing: number;
  hp: number;
  mode: UnitMode;
  modeTimer: number;
  /** Order queue, head runs now. Empty = idle. At most MAX_ORDERS. */
  orders: Order[];
  /** Ticks until the weapon can fire again. */
  cooldown: number;
  /** Factory only: queued jobs, head is in progress. */
  queue: BuildJob[];
  /** Ticks since this unit last fired. Lets the client draw muzzle flashes. */
  lastFired: number;
  /** Weapon target unit id, 0 = none. */
  target: number;
  /** Turret yaw in angle steps. Follows `target`, else `facing`. */
  aim: number;
  /** Gun elevation as slope in permille, of the arc combat solved this tick, direct or ballistic; 0 when none. Drawn by the client barrel. */
  elevation: number;
  /**
   * Engineer only: id of what it works on this tick, 0 = none. Written by `repair`.
   * A unit it heals or a factory whose job it speeds up, or a scrap feature it reclaims. Feature and unit ids never clash.
   */
  work: number;
  /** Group of the move this unit finished, 0 = none. Cleared by any new order. A moving unit of the same group that touches it stops too. */
  arrived: number;
  /** Factory only: where new units drive to. null = they stay beside the factory. */
  rally: { x: number; y: number } | null;
  /** Factory only: how many of each kind the owner wants alive, 1..MAX_QUOTA. A missing kind is 0. */
  quota: Partial<Record<UnitKind, number>>;
}

/** A shell in flight. Position and velocity are fixed-point: 1/PROJ_FP world units. z is height. */
export interface Projectile {
  id: number;
  owner: number;
  /** Id of the unit that fired it. A direct shell passes through that unit's body and stops at any other. */
  shooter: number;
  /** The kind of unit that fired it. Picks the look on the client. */
  source: UnitKind;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  damage: number;
  /** Splash radius in world units. Damage falls off linearly to 0 at the edge. */
  splash: number;
  /** Height units it lowers the ground at the centre. */
  dig: number;
  /** Ticks left before it is removed. */
  ttl: number;
}

/**
 * One explosion. It damages units, features and the ground (`blast.ts`), the units of every player alike.
 * x, y, z are fixed-point like a projectile. `radius` is world units; damage falls off linearly to 0 at the edge.
 */
export interface Blast {
  x: number;
  y: number;
  z: number;
  damage: number;
  radius: number;
  /** Height units it lowers the ground at the centre; the bowl falls off to 0 at `radius`. */
  dig: number;
}

/** A box of terrain vertices, inclusive on both ends. */
export interface VertexBox { i0: number; j0: number; i1: number; j1: number }

/**
 * Height map. Vertex (i, j) sits at (i·cell, j·cell); heights row-major, j·cols + i. Blasts lower it (`terrain/crater.ts`).
 * cols = width/cell + 1, rows = height/cell + 1; `mapSize.ts` derives the map size.
 */
export interface Terrain {
  /** Vertices along x. */
  cols: number;
  /** Vertices along y. */
  rows: number;
  cell: number;
  heights: number[];
  /** Water fills every point whose ground is below this height. Set once from the starting heights (`terrain/water.ts`); craters do not move it. */
  seaLevel: number;
}

/** Map extent in world units, integers. The map is 0..width by 0..height. */
export interface MapSize {
  width: number;
  height: number;
}

/** What `generateMap` needs besides the seed. `cell` divides width, height and 1000. */
export interface MapParams extends MapSize {
  cell: number;
}

/** A map as plain data. No ids: `createWorld` assigns them. Feature hp comes from `FEATURE_STATS`. */
export interface MapSpec {
  width: number;
  height: number;
  cell: number;
  /** cols·rows integers, 0..TERRAIN_MAX_HEIGHT. */
  heights: number[];
  /** World rng at tick 0, after generation. uint32. */
  rng: number;
  fields: { x: number; y: number; radius: number; amount: number }[];
  features: { kind: MapFeatureKind; x: number; y: number; radius: number; variant: number }[];
}

export interface Player {
  id: number;
  name: string;
  color: number;
  credits: number;
  alive: boolean;
  /** False after the player disconnects. Their units are removed at once. */
  connected: boolean;
  /** Players with the same team are allies (`teams.ts`). A player alone on its team is a free-for-all player. */
  team: number;
}

export interface ResourceField {
  id: number;
  x: number;
  y: number;
  radius: number;
  /** Credits left. The field is empty at 0 and refills slowly. */
  amount: number;
}

/** Rules per kind live in `features/featureStats.ts`. */
export type FeatureKind = "rock" | "boulder" | "tree" | "scrap" | "wreckage";

/** The kinds a map holds. `scrap` and `wreckage` only come from dead units (`features/wreck.ts`). */
export type MapFeatureKind = Exclude<FeatureKind, "scrap" | "wreckage">;

/** A rock or tree on the map, or what a dead unit left. Sim state: it blocks, slows or stops shells. */
export interface Feature {
  id: number;
  kind: FeatureKind;
  x: number;
  y: number;
  radius: number;
  /** 0 for a feature that cannot be destroyed. */
  hp: number;
  /** Picks a model variant on the client. No sim meaning. */
  variant: number;
  /** The kind of unit that died here. Set on `scrap` and `wreckage`, absent on map features. */
  unit?: UnitKind;
}

export interface World {
  tick: number;
  /** Seeded RNG state, uint32. Only the sim may advance it. */
  rng: number;
  nextId: number;
  /** Sorted by id. */
  players: Player[];
  /** Sorted by id. Iterate in this order only. */
  units: Unit[];
  fields: ResourceField[];
  /** Sorted by id. Removed when destroyed or crushed. */
  features: Feature[];
  /** Sorted by id. */
  projectiles: Projectile[];
  /** Death blasts queued by `deaths`. The next tick's `projectiles` detonates them in order, then clears the list. */
  blasts: Blast[];
  terrain: Terrain;
  /** Per terrain vertex: how far blasts have lowered it below its start. Capped at MAX_DIG. */
  dug: number[];
}

// ---- Intents: the only input to the sim. ----

export type Intent =
  /** Generated by the host for each match player in the first turn. `x`, `y`: the picked factory spot; without it the sim picks one. */
  | { t: "join"; name: string; x?: number; y?: number; team?: number }
  /** Generated by the host when a player's connection closes. */
  | { t: "leave" }
  // `queue`: append to each unit's orders; otherwise replace them.
  /**
   * A sieged or deploying unit with no orders ignores a move unless `force`.
   * A move that comes up later in a queue always runs; the unit packs up first.
   * `path` (2 or more points): spots spread along this line instead of a block around (x, y).
   * `attack`: an attack-move (see the `move` order).
   */
  | { t: "move"; units: number[]; x: number; y: number; force: boolean; queue: boolean; attack: boolean; path?: { x: number; y: number }[] }
  | { t: "attack"; units: number[]; target: number; queue: boolean }
  /** Clears the order queue. */
  | { t: "stop"; units: number[] }
  | { t: "siege"; units: number[]; on: boolean; queue: boolean }
  | { t: "guard"; units: number[]; target: number; queue: boolean }
  /** Own engineers reclaim the scrap feature `target`. Any player may reclaim any scrap. */
  | { t: "reclaim"; units: number[]; target: number; queue: boolean }
  | { t: "build"; factory: number; kind: UnitKind }
  /** Remove the listed job ids (at most MAX_QUEUE) from an own factory's queue and refund each. Missing ids are skipped. */
  | { t: "cancel"; factory: number; jobs: number[] }
  /** Set the rally point of each listed own factory. Other kinds are skipped. */
  | { t: "rally"; units: number[]; x: number; y: number }
  /** Add `delta` to an own factory's quota for `kind`, clamped to 0..MAX_QUOTA. */
  | { t: "quota"; factory: number; kind: UnitKind; delta: number };

/** An intent with the player who sent it. The sim trusts `player`, and checks unit ownership itself. */
export interface Stamped {
  player: number;
  intent: Intent;
}
