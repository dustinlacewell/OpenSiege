import type { Unit, UnitKind } from "@mf/sim";

/** An own unit's state at the last think. `rate` is hp per tick lost in its last drop, 0 if none yet. */
export interface LastHp {
  hp: number;
  x: number;
  y: number;
  kind: UnitKind;
  tick: number;
  rate: number;
}

/** An own unit lost hp since the last think. `rate` is `amount` per tick over that gap. */
export interface Hurt {
  id: number;
  kind: UnitKind;
  x: number;
  y: number;
  amount: number;
  rate: number;
  tick: number;
}

/** An own unit is gone. `rate` is its last drop's rate, 0 if it was never hurt. */
export interface Loss {
  id: number;
  kind: UnitKind;
  x: number;
  y: number;
  rate: number;
  tick: number;
}

/** Compares own units with their hp at the last think. A drop is a hurt, a missing unit is a loss. Repair is no event. */
export function hurtEvents(
  lastHp: ReadonlyMap<number, LastHp>,
  own: readonly Readonly<Unit>[],
  tick: number,
): { hurts: Hurt[]; losses: Loss[]; nextHp: Map<number, LastHp> } {
  const hurts: Hurt[] = [];
  const nextHp = new Map<number, LastHp>();
  for (const u of own) {
    const hurt = hurtOf(lastHp.get(u.id), u, tick);
    if (hurt) hurts.push(hurt);
    nextHp.set(u.id, { hp: u.hp, x: u.x, y: u.y, kind: u.kind, tick, rate: hurt?.rate ?? lastHp.get(u.id)?.rate ?? 0 });
  }
  return { hurts, losses: lossesOf(lastHp, nextHp, tick), nextHp };
}

function hurtOf(before: LastHp | undefined, u: Readonly<Unit>, tick: number): Hurt | null {
  if (!before || u.hp >= before.hp) return null;
  const amount = before.hp - u.hp;
  return { id: u.id, kind: u.kind, x: u.x, y: u.y, amount, rate: amount / Math.max(1, tick - before.tick), tick };
}

function lossesOf(lastHp: ReadonlyMap<number, LastHp>, nextHp: ReadonlyMap<number, LastHp>, tick: number): Loss[] {
  const out: Loss[] = [];
  for (const [id, b] of lastHp) if (!nextHp.has(id)) out.push({ id, kind: b.kind, x: b.x, y: b.y, rate: b.rate, tick });
  return out;
}
