import type { Intent, Stamped, World } from "./types.ts";
import type { IntentTable } from "./intents/handler.ts";
import { attack } from "./intents/attack.ts";
import { build } from "./intents/build.ts";
import { cancel } from "./intents/cancel.ts";
import { guard } from "./intents/guard.ts";
import { join } from "./intents/join.ts";
import { leave } from "./intents/leave.ts";
import { move } from "./intents/move.ts";
import { quota } from "./intents/quota.ts";
import { rally } from "./intents/rally.ts";
import { reclaim } from "./intents/reclaim.ts";
import { siege } from "./intents/siege.ts";
import { stop } from "./intents/stop.ts";

/** One row per intent tag. TypeScript refuses a missing row. */
const HANDLERS: IntentTable = { join, leave, move, attack, stop, siege, guard, reclaim, build, cancel, rally, quota };

/** Apply intents in array order. Bad or foreign references are dropped, never thrown. */
export function applyIntents(world: World, intents: readonly Stamped[]): void {
  for (const s of intents) {
    if (s && typeof s.intent === "object" && s.intent !== null) applyIntent(world, s.player, s.intent);
  }
}

/** Unknown tags do nothing. `hasOwn` keeps `"toString"` and friends out of the table. */
function applyIntent(world: World, player: number, intent: Intent): void {
  if (!Object.hasOwn(HANDLERS, intent.t)) return;
  const handler = HANDLERS[intent.t] as (world: World, player: number, intent: Intent) => void;
  handler(world, player, intent);
}
