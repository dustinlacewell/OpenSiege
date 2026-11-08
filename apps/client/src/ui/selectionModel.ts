import { UNIT_KINDS, UNIT_STATS, type Unit, type UnitKind, type UnitMode, type World } from "@mf/sim";
import { unitById } from "../game/lookup.ts";
import { unitReadouts, type Readout } from "./unitReadouts.ts";

/** Tiles in the several-units grid: 9 columns by 3 rows. */
export const MULTI_SLOTS = 27;

export type HpTone = "high" | "mid" | "low";

export interface UnitCard {
  id: number;
  kind: UnitKind;
  hp: number;
  maxHp: number;
  /** 0..100. */
  hpPct: number;
  tone: HpTone;
  /** Control group number, 0 = none. */
  group: number;
}

export interface UnitDetail extends UnitCard {
  mode: UnitMode;
  /** "Guarding <kind>" when the head order is guard, else "". */
  activity: string;
  readouts: Readout[];
}

export interface SelectionView {
  count: number;
  /** Exactly one unit selected: its details. Else null. */
  single: UnitDetail | null;
  /** Two or more selected: cards by kind order, then id. At most MULTI_SLOTS, one less when `more` > 0. */
  cards: UnitCard[];
  /** Units that did not fit. The last tile shows "+more". */
  more: number;
}

/** `groupOf` gives a unit's control group, or 0. */
export function selectionView(world: World, selected: readonly number[], groupOf: (id: number) => number): SelectionView {
  const units = sortedUnits(world, selected);
  if (units.length === 1) return { count: 1, single: detail(world, units[0]!, groupOf), cards: [], more: 0 };
  const fit = units.length > MULTI_SLOTS ? MULTI_SLOTS - 1 : units.length;
  return { count: units.length, single: null, cards: units.slice(0, fit).map((u) => card(u, groupOf)), more: units.length - fit };
}

function sortedUnits(world: World, selected: readonly number[]): Unit[] {
  const out: Unit[] = [];
  for (const id of selected) {
    const u = unitById(world.units, id);
    if (u) out.push(u);
  }
  return out.sort((a, b) => UNIT_KINDS.indexOf(a.kind) - UNIT_KINDS.indexOf(b.kind) || a.id - b.id);
}

function card(u: Unit, groupOf: (id: number) => number): UnitCard {
  const maxHp = UNIT_STATS[u.kind].maxHp;
  const hp = Math.max(0, Math.ceil(u.hp));
  const hpPct = Math.min(100, Math.round((hp / maxHp) * 100));
  return { id: u.id, kind: u.kind, hp, maxHp, hpPct, tone: hpPct > 60 ? "high" : hpPct > 30 ? "mid" : "low", group: groupOf(u.id) };
}

function detail(world: World, u: Unit, groupOf: (id: number) => number): UnitDetail {
  return { ...card(u, groupOf), mode: u.mode, activity: activity(world, u), readouts: unitReadouts(u.kind, u.mode) };
}

/** What the head order is doing, for orders worth naming. Only guard for now. */
function activity(world: World, u: Unit): string {
  const o = u.orders[0];
  const target = o?.type === "guard" ? unitById(world.units, o.target) : undefined;
  return target ? `Guarding ${target.kind}` : "";
}
