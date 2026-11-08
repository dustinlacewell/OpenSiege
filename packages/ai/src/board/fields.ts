import type { ResourceField, Unit } from "@mf/sim";
import { unitPower } from "../assess/power.ts";
import { dangerAt, type Danger } from "../danger/query.ts";
import type { Ally } from "../perception/picture.ts";

/** Own and allied power within this distance of a field centre covers the field. */
const COVER = 1500;

/** One resource field as the board sees it. */
export interface FieldState {
  id: number;
  x: number;
  y: number;
  amount: number;
  danger: number;
  ownPower: number;
}

/** Wealth, danger at the centre, and own plus allied power near each field. */
export function fieldStates(fields: readonly Readonly<ResourceField>[], own: readonly Readonly<Unit>[], allies: readonly Ally[], danger: Danger): FieldState[] {
  const friends = [...own, ...allies];
  return fields.map((f) => ({
    id: f.id,
    x: f.x,
    y: f.y,
    amount: f.amount,
    danger: dangerAt(danger, f.x, f.y),
    ownPower: powerNear(friends, f),
  }));
}

function powerNear(units: readonly Pick<Unit, "kind" | "mode" | "hp" | "x" | "y">[], p: { x: number; y: number }): number {
  let s = 0;
  for (const u of units) if ((u.x - p.x) ** 2 + (u.y - p.y) ** 2 <= COVER * COVER) s += unitPower(u.kind, u.mode, u.hp);
  return s;
}
