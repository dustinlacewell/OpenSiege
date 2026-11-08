import { radarRange, TICK_MS, UNIT_STATS, weaponOf, workRateOf, type UnitKind, type UnitMode } from "@mf/sim";

/** A label and the value it names. */
export interface Readout {
  label: string;
  value: string;
}

/** The most readouts one unit shows. */
export const MAX_READOUTS = 4;

const PER_SECOND = 1000 / TICK_MS;
const OFF = "—";

/** What each kind's work rate measures, and how one rate (per tick) reads. */
const WORK: Partial<Record<UnitKind, Readonly<{ label: string; format: (perTick: number) => string }>>> = {
  harvester: { label: "Harvest", format: (r) => `${r * PER_SECOND} cr/s` },
  engineer: { label: "Repair", format: (r) => `${r * PER_SECOND} hp/s` },
  factory: { label: "Build", format: (r) => `×${r}` },
};

/**
 * Key stats of a unit at its current mode, from the sim's `weaponOf` and `workRateOf`.
 * Weapons and work stop while deploying or packing.
 */
export function unitReadouts(kind: UnitKind, mode: UnitMode): Readout[] {
  return [...weapon(kind, mode), ...work(kind, mode), ...radar(kind, mode), ...armor(kind, mode)];
}

function weapon(kind: UnitKind, mode: UnitMode): Readout[] {
  const s = UNIT_STATS[kind];
  if (s.damage <= 0) return [];
  const w = weaponOf({ kind, mode });
  return [
    { label: "Damage", value: w ? String(w.damage) : OFF },
    { label: "Range", value: w ? String(w.range) : OFF },
    { label: "Reload", value: `${(s.reload * TICK_MS) / 1000} s` },
  ];
}

function work(kind: UnitKind, mode: UnitMode): Readout[] {
  const w = WORK[kind];
  return w ? [{ label: w.label, value: w.format(workRateOf({ kind, mode })) }] : [];
}

/** Radar range now, for kinds whose radar grows when sieged (the radar truck). */
function radar(kind: UnitKind, mode: UnitMode): Readout[] {
  const s = UNIT_STATS[kind];
  return s.siegeRadar > s.radar ? [{ label: "Radar", value: String(radarRange({ kind, mode })) }] : [];
}

function armor(kind: UnitKind, mode: UnitMode): Readout[] {
  const a = UNIT_STATS[kind].siegeArmor;
  return mode === "sieged" && a !== 100 ? [{ label: "Damage taken", value: `${a}%` }] : [];
}
