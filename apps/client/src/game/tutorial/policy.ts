// What a tutorial step lets the player do: which intents pass, which units may be selected and commanded.
import type { Intent, World } from "@mf/sim";
import { unitById } from "../lookup.ts";
import type { IntentRule, Policy } from "./types.ts";

/** Unit orders: a part of the unit list can still carry them out. Attack-move is a move. */
type UnitOrder = Extract<Intent, { t: "move" | "guard" | "stop" }>;
const UNIT_ORDERS: ReadonlySet<Intent["t"]> = new Set<UnitOrder["t"]>(["move", "guard", "stop"]);

/**
 * The intent to send, or null to drop it. A unit order the policy has a rule for loses its non-commandable units
 * first; with none left it is dropped. Then the rules decide. Other tags are never changed (siege of a factory stays).
 */
export function admit(policy: Policy, intent: Intent, world: World, me: number): Intent | null {
  if (!mayIssue(policy, intent.t)) return null;
  const narrowed = UNIT_ORDERS.has(intent.t) ? commandableOnly(policy, intent as UnitOrder, world, me) : intent;
  return narrowed && permits(policy, narrowed, world, me) ? narrowed : null;
}

/** The order with only commandable, existing units; the same object when nothing goes. Null when none is left. */
function commandableOnly(policy: Policy, intent: UnitOrder, world: World, me: number): UnitOrder | null {
  const units = intent.units.filter((id) => {
    const u = unitById(world.units, id);
    return u !== undefined && policy.commandable(u, me);
  });
  if (units.length === 0) return null;
  return units.length === intent.units.length ? intent : { ...intent, units };
}

/** True when some rule has the intent's tag and its `where` is absent or holds. */
export function permits(policy: Policy, intent: Intent, world: World, me: number): boolean {
  return policy.intents.some((r) => r.t === intent.t && (r.where?.(intent, world, me) ?? true));
}

/** True when some rule has tag `t`. For modes (guard, attack-move) that have no intent yet. */
export function mayIssue(policy: Policy, t: Intent["t"]): boolean {
  return policy.intents.some((r) => r.t === t);
}

/** The ids whose unit exists and is selectable, in input order. */
export function allowedSelection(policy: Policy, world: World, me: number, ids: readonly number[]): number[] {
  return ids.filter((id) => {
    const u = unitById(world.units, id);
    return u !== undefined && policy.selectable(u, me);
  });
}

/** Every tag. A new Intent tag is a type error here until it is listed. */
const ALL_TAGS: Record<Intent["t"], true> = {
  join: true, leave: true, move: true, attack: true, stop: true, siege: true, guard: true,
  reclaim: true, build: true, cancel: true, rally: true, quota: true,
};

/** Every intent allowed, every unit selectable and commandable. The host already rejects join and leave from clients. */
export const FREE_POLICY: Policy = {
  intents: (Object.keys(ALL_TAGS) as Intent["t"][]).map((t): IntentRule => ({ t })),
  selectable: () => true,
  commandable: () => true,
};
