import unitStatsFile from "../data/unitStats.json" with { type: "json" };
import { describeStatErrors, parseUnitStats } from "./statsData.ts";
import type { UnitKind } from "./types.ts";

/** One sim tick, in milliseconds. Every peer steps at this rate. */
export const TICK_MS = 100;
/** Most resource fields a map may hold. Also the size of the field array in the terrain shader. */
export const MAX_FIELDS = 64;
export const ANGLE_STEPS = 256;
export const START_CREDITS = 600;
/** Fixed-point scale of projectile position and velocity. */
export const PROJ_FP = 16;
/** Downward pull on shells, in 1/PROJ_FP world units per tick². */
export const GRAVITY = 24;
/** Height map peak height, in world units. */
export const TERRAIN_MAX_HEIGHT = 900;

/**
 * direct: fast, flat shot that hills block. ballistic: high arc that lands on the aim point.
 * mine: no shell. The unit destroys itself when an enemy is within `range`, and its death blast does the damage.
 */
export type WeaponKind = "none" | "direct" | "ballistic" | "mine";

/** Which nav grid a unit drives on (`nav/moveClass.ts`). light: climbs steeper ground. heavy: climbs less and keeps clear of cliffs and features. climber: scrambles up much steeper ground, slowed little by it. */
export type MoveClass = "light" | "heavy" | "climber";

export interface UnitStats {
  /** Picks the nav grid. Adding a kind needs no nav code. */
  moveClass: MoveClass;
  cost: number;
  buildTicks: number;
  maxHp: number;
  radius: number;
  /** Model height. A shell hits the unit when it passes inside radius and below ground + height. */
  height: number;
  weapon: WeaponKind;
  /** Shell speed along the ground, world units per tick. */
  shotSpeed: number;
  /** Splash radius of the shell, world units. */
  splash: number;
  /** Height units a shell lowers the ground at its centre, mobile or sieged. Independent of damage. */
  dig: number;
  /** Direct weapon: steepest gun elevation in whole degrees, to lob a shell over a hill. 0 = flat shot only. */
  maxPitch: number;
  /** Nearest flat distance at which the unit picks a target, world units, mobile or sieged. 0 = none. */
  minRange: number;
  /** Barrel breech pivot in turret space, world units: forward along the aim, and up from the ground. */
  gunX: number;
  gunZ: number;
  /** Barrel length, world units. 0 = shells start at the unit's centre, 70% of its height up (`muzzle.ts`). */
  gunLength: number;
  /** Barrel elevation at rest, as modelled, whole degrees. */
  gunRest: number;
  /** World units per tick. 0 while not mobile. */
  speed: number;
  /** Hull turn speed, angle steps per tick (ANGLE_STEPS = one full turn). */
  turnRate: number;
  /** Percent of speed kept while the unit's centre is in water (`terrain/water.ts`). */
  waterSpeed: number;
  /** Ticks to deploy, and ticks to pack up again. 0 = has no siege mode. */
  siegeTicks: number;
  /** How far the hull (and turret and barrel) settles when fully sieged, world units. The client draws it; the barrel tip (`muzzle.ts`) follows it. */
  sink: number;
  /** Weapon. damage 0 = unarmed. */
  damage: number;
  range: number;
  reload: number;
  /** Death blast: damage at the centre, and radius in world units. Hurts every unit. Either 0 = no blast. */
  deathDamage: number;
  deathRadius: number;
  /** Height units the death blast lowers the ground at its centre. */
  deathDig: number;
  /** Hit points of the scrap it leaves when it dies. 0 = it leaves wreckage only (`features/wreck.ts`). */
  scrapHp: number;
  /** Weapon while sieged. Same as mobile values if no bonus. */
  siegeDamage: number;
  siegeRange: number;
  /** Damage taken is multiplied by armor/100 while sieged. */
  siegeArmor: number;
  /** Harvester: credits per tick when inside a field. Engineer: hp repaired per tick to one target. */
  workRate: number;
  siegeWorkRate: number;
  /** Factory and engineer: radius of their work while sieged. */
  workRange: number;
  /** Client fog of war: how far the unit sees, world units. No sim system reads it. */
  sight: number;
  /** Client fog of war: how far the unit senses enemies as rough radar dots, world units. No sim system reads it. */
  radar: number;
  /** Radar range while sieged. Same as `radar` if no bonus. Read through `radarRange`. */
  siegeRadar: number;
  /** Enemy radar cannot detect this team's units within this distance of it, world units. Sight still can. Read through `jamRange`. */
  jam: number;
  /** Jam radius while sieged. Same as `jam` if no bonus. Read through `jamRange`. */
  siegeJam: number;
  /** While sieged, enemies cannot see it, by sight or radar. Its own `siegeJam` covers it against radar. Read by `detection.ts`. */
  siegeHidden: boolean;
  /** A factory may build it. */
  buildable: boolean;
}

/**
 * Every unit's numbers, from `data/unitStats.json`. The dev stat editor writes that file (`docs/architecture/sim/stats.md`).
 * Every peer must load the same file: it is part of the sim. A bad file stops start-up with one line per error.
 * Row order in the file is the kind order the client lists units in (`UNIT_KINDS`).
 */
export const UNIT_STATS: Record<UnitKind, UnitStats> = load(unitStatsFile);

function load(raw: unknown): Record<UnitKind, UnitStats> {
  const parsed = parseUnitStats(raw);
  if (!parsed.ok) throw new Error(`data/unitStats.json:\n${describeStatErrors(parsed.errors)}`);
  return parsed.stats;
}

/** Every kind, in `UNIT_STATS` row order. Iterate this, never a hand-written list of kinds. */
export const UNIT_KINDS = Object.keys(UNIT_STATS) as readonly UnitKind[];

/** Most orders one unit may hold in its queue. */
export const MAX_ORDERS = 32;

/** Most points in the `path` of one move intent. */
export const MAX_PATH_POINTS = 32;

/** Most jobs one factory may hold, the one in progress included. */
export const MAX_QUEUE = 30;

/** Highest quota a factory may hold for one kind. */
export const MAX_QUOTA = 20;

/** A mobile engineer works on one target within this distance. A sieged one uses `workRange`. */
export const MOBILE_REPAIR_REACH = 200;

/** Percent of a unit's cost that reclaiming its full-hp scrap pays back (`features/reclaim.ts`). */
export const RECLAIM_PERCENT = 50;

/** A mobile engineer adds 1 progress to its factory's job every this many ticks (0.25 per tick). */
export const BOOST_MOBILE_EVERY = 4;
/** A sieged engineer adds this much progress per tick to its factory's job. */
export const BOOST_SIEGED = 2;

/** A guard further than this gap (plus both radii) from its target drives back. */
export const GUARD_LEASH = 250;
/** A following guard stops once inside this gap (plus both radii). Below GUARD_LEASH, so guards do not stutter. */
export const GUARD_RETURN = 120;
/** How far past the leash a guard may go to engage or repair. */
export const GUARD_MARGIN = 200;
/** Guards engage enemies and repair friendlies within this distance of their target. */
export const GUARD_RANGE = 700;

/** An attack-move engages an enemy within this distance beyond its effective range. */
export const ENGAGE_START = 300;
/** An engage ends when its target is farther than this beyond effective range. Above ENGAGE_START, so no re-engage loop. */
export const ENGAGE_END = 600;
/** An engage ends when the unit is farther than this from its anchor. */
export const ENGAGE_LEASH = 900;

/** What a factory may build: the kinds with `buildable` set. */
export const BUILDABLE: readonly UnitKind[] = UNIT_KINDS.filter((k) => UNIT_STATS[k].buildable);
