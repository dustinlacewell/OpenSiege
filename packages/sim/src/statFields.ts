import type { MoveClass, UnitStats, WeaponKind } from "./stats.ts";

// What each `UnitStats` field is: its label, its group, its unit and its legal range. Pure data.
// `data/unitStats.json` holds the values. The loader (`statsData.ts`) and the dev stat editor both read this.
// Object order is display order and file order.

export type SectionId = "economy" | "body" | "movement" | "siege" | "weapon" | "siegeWeapon" | "work" | "vision";

export const STAT_SECTIONS: readonly { id: SectionId; label: string }[] = [
  { id: "economy", label: "Economy" },
  { id: "body", label: "Body" },
  { id: "movement", label: "Movement" },
  { id: "siege", label: "Siege" },
  { id: "weapon", label: "Weapon" },
  { id: "siegeWeapon", label: "Siege weapon" },
  { id: "work", label: "Work" },
  { id: "vision", label: "Vision" },
];

interface FieldBase {
  label: string;
  section: SectionId;
  /** What one step of the value is: "hp", "ticks", "world units". Empty when the label says it. */
  unit: string;
  help: string;
}

export type StatField =
  | (FieldBase & { type: "int"; min: number; max: number })
  | (FieldBase & { type: "bool" })
  | (FieldBase & { type: "enum"; options: readonly string[] });

const WEAPONS: readonly WeaponKind[] = ["none", "direct", "ballistic", "mine"];
const MOVE_CLASSES: readonly MoveClass[] = ["light", "heavy", "climber"];

export const STAT_FIELDS: { [K in keyof UnitStats]: StatField } = {
  cost: { type: "int", min: 0, max: 100000, label: "Cost", section: "economy", unit: "credits", help: "Charged in full when a factory queues it." },
  buildTicks: { type: "int", min: 1, max: 100000, label: "Build time", section: "economy", unit: "work", help: "Work a factory needs to finish it. A mobile factory does 1 per tick, a sieged one 4." },
  buildable: { type: "bool", label: "Buildable", section: "economy", unit: "", help: "A factory may build it." },

  maxHp: { type: "int", min: 1, max: 100000, label: "Max HP", section: "body", unit: "hp", help: "Hit points at full health." },
  radius: { type: "int", min: 1, max: 500, label: "Radius", section: "body", unit: "world units", help: "Hull radius. Sets collision, spacing and where shells land." },
  height: { type: "int", min: 1, max: 500, label: "Height", section: "body", unit: "world units", help: "Model height. A shell hits when it passes inside the radius and below ground plus this." },

  moveClass: { type: "enum", options: MOVE_CLASSES, label: "Move class", section: "movement", unit: "", help: "Picks the nav grid. Light climbs steeper ground. Heavy climbs less and keeps clear of cliffs and features. Climber scrambles up much steeper ground and is slowed little by it." },
  speed: { type: "int", min: 0, max: 200, label: "Speed", section: "movement", unit: "world units/tick", help: "Drive speed. 0 while not mobile." },
  turnRate: { type: "int", min: 0, max: 256, label: "Turn rate", section: "movement", unit: "steps/tick", help: "Hull turn speed. 256 steps are one full turn." },
  waterSpeed: { type: "int", min: 1, max: 100, label: "Water speed", section: "movement", unit: "% speed", help: "Speed kept in water, in percent." },

  siegeTicks: { type: "int", min: 0, max: 1000, label: "Siege time", section: "siege", unit: "ticks", help: "Ticks to deploy, and to pack up again. 0 means no siege mode." },
  siegeArmor: { type: "int", min: 1, max: 1000, label: "Siege armor", section: "siege", unit: "% damage taken", help: "Damage taken while sieged, in percent. Below 100 is tougher." },
  sink: { type: "int", min: 0, max: 200, label: "Sink", section: "siege", unit: "world units", help: "How far the hull settles when sieged. The gun drops with it." },

  weapon: { type: "enum", options: WEAPONS, label: "Weapon", section: "weapon", unit: "", help: "Direct: a fast flat shot that hills block. Ballistic: a high arc that lands on the aim point. Mine: blows itself up with the death blast when an enemy is in range; Range is the trigger distance. None: unarmed." },
  damage: { type: "int", min: 0, max: 10000, label: "Damage", section: "weapon", unit: "hp", help: "Damage at the centre of a hit. 0 means unarmed." },
  range: { type: "int", min: 0, max: 20000, label: "Range", section: "weapon", unit: "world units", help: "How far it shoots." },
  reload: { type: "int", min: 1, max: 1000, label: "Reload", section: "weapon", unit: "ticks", help: "Ticks between shots." },
  shotSpeed: { type: "int", min: 0, max: 1000, label: "Shell speed", section: "weapon", unit: "world units/tick", help: "Shell speed along the ground." },
  splash: { type: "int", min: 0, max: 2000, label: "Splash", section: "weapon", unit: "world units", help: "Splash radius. Damage falls off to 0 at the edge." },
  dig: { type: "int", min: 0, max: 100, label: "Dig", section: "weapon", unit: "height units", help: "How far a shell lowers the ground at the centre, mobile or sieged. 0 leaves the ground alone." },
  maxPitch: { type: "int", min: 0, max: 60, label: "Max pitch", section: "weapon", unit: "degrees", help: "Steepest angle the gun can raise to clear hills. 0 = flat shot only." },
  minRange: { type: "int", min: 0, max: 20000, label: "Min range", section: "weapon", unit: "world units", help: "Nearest distance it picks a target, mobile or sieged. 0 = none." },
  gunX: { type: "int", min: 0, max: 500, label: "Gun X", section: "weapon", unit: "world units", help: "Barrel breech, forward of the centre along the aim." },
  gunZ: { type: "int", min: 0, max: 500, label: "Gun Z", section: "weapon", unit: "world units", help: "Barrel breech, height above the ground." },
  gunLength: { type: "int", min: 0, max: 500, label: "Gun length", section: "weapon", unit: "world units", help: "Barrel length. Shells start at its tip. 0 = from the centre." },
  gunRest: { type: "int", min: 0, max: 89, label: "Gun rest", section: "weapon", unit: "degrees", help: "Barrel elevation as modelled." },

  deathDamage: { type: "int", min: 0, max: 10000, label: "Death damage", section: "weapon", unit: "hp", help: "Damage at the centre of the blast when it dies. Hurts every unit, its own team too. 0 means no blast." },
  deathRadius: { type: "int", min: 0, max: 2000, label: "Death radius", section: "weapon", unit: "world units", help: "Radius of the death blast. Damage falls off to 0 at the edge." },
  deathDig: { type: "int", min: 0, max: 100, label: "Death dig", section: "weapon", unit: "height units", help: "How far the death blast lowers the ground at the centre. 0 leaves the ground alone." },
  scrapHp: { type: "int", min: 0, max: 10000, label: "Scrap HP", section: "weapon", unit: "hp", help: "Hit points of the scrap it leaves. 0 leaves wreckage only." },

  siegeDamage: { type: "int", min: 0, max: 10000, label: "Damage", section: "siegeWeapon", unit: "hp", help: "Damage while sieged. Same as the mobile value if there is no bonus." },
  siegeRange: { type: "int", min: 0, max: 20000, label: "Range", section: "siegeWeapon", unit: "world units", help: "Range while sieged. Same as the mobile value if there is no bonus." },

  workRate: { type: "int", min: 0, max: 1000, label: "Work rate", section: "work", unit: "per tick", help: "Factory: build progress. Harvester: credits. Engineer: hp healed to one target." },
  siegeWorkRate: { type: "int", min: 0, max: 1000, label: "Siege work rate", section: "work", unit: "per tick", help: "The same, while sieged." },
  workRange: { type: "int", min: 0, max: 20000, label: "Work range", section: "work", unit: "world units", help: "Factory and engineer: radius of the work while sieged." },

  sight: { type: "int", min: 0, max: 20000, label: "Sight", section: "vision", unit: "world units", help: "How far the unit sees. Hills block it. Fog of war only." },
  radar: { type: "int", min: 0, max: 20000, label: "Radar", section: "vision", unit: "world units", help: "How far it senses enemies as rough dots. Hills do not block it. Fog of war only." },
  siegeRadar: { type: "int", min: 0, max: 20000, label: "Siege radar", section: "vision", unit: "world units", help: "Radar range while sieged. Same as radar if there is no bonus." },
  jam: { type: "int", min: 0, max: 20000, label: "Jam", section: "vision", unit: "world units", help: "Enemy radar cannot see your units this close to it. Sight still can." },
  siegeJam: { type: "int", min: 0, max: 20000, label: "Siege jam", section: "vision", unit: "world units", help: "Jam radius while sieged. Same as jam if there is no bonus." },
  siegeHidden: { type: "bool", label: "Siege hidden", section: "vision", unit: "", help: "While sieged, enemies cannot see it by sight. Radar is blocked by its own siege jam." },
};

/** Every field key, in display and file order. */
export const STAT_KEYS = Object.keys(STAT_FIELDS) as readonly (keyof UnitStats)[];
