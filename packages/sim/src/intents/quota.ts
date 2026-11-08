import { BUILDABLE, MAX_QUOTA } from "../stats.ts";
import { toInt } from "../math.ts";
import type { IntentHandler } from "./handler.ts";
import { ownFactory } from "./lookup.ts";

/** Adds `delta` to an own factory's quota for a buildable kind, clamped to 0..MAX_QUOTA. 0 removes the key. */
export const quota: IntentHandler<"quota"> = (world, player, intent) => {
  const f = ownFactory(world, player, intent.factory);
  const k = BUILDABLE.find((b) => b === intent.kind);
  const delta = toInt(intent.delta);
  if (!f || !k || delta === null) return;
  const next = Math.max(0, Math.min(MAX_QUOTA, (f.quota[k] ?? 0) + delta));
  if (next > 0) f.quota[k] = next;
  else delete f.quota[k];
};
