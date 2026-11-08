import { UNIT_STATS } from "../stats.ts";
import { advance, head } from "../orders.ts";
import { isAnchored, startDeploying, startPacking } from "../siege.ts";
import type { Unit, World } from "../types.ts";

/**
 * Start the mode change the head order needs, then count down deploy/pack timers.
 * deploying → sieged, packing → mobile.
 */
export function modes(world: World): void {
  for (const u of world.units) {
    followHead(u);
    tickTimer(u);
  }
}

/**
 * siege on: deploy when mobile; done once sieged. siege off: pack when anchored; done once mobile.
 * A move that comes up while anchored packs the unit; movement takes it once mobile.
 */
function followHead(u: Unit): void {
  const o = head(u);
  if (o?.type === "siege") {
    if (o.on) siegeOn(u);
    else siegeOff(u);
  } else if (o?.type === "move" && isAnchored(u)) {
    startPacking(u);
  }
}

/** Kinds that cannot siege drop the order. */
function siegeOn(u: Unit): void {
  if (u.mode === "sieged" || UNIT_STATS[u.kind].siegeTicks <= 0) advance(u);
  else if (u.mode === "mobile") startDeploying(u);
}

function siegeOff(u: Unit): void {
  if (u.mode === "mobile") advance(u);
  else if (isAnchored(u)) startPacking(u);
}

function tickTimer(u: Unit): void {
  if (u.mode !== "deploying" && u.mode !== "packing") return;
  if (--u.modeTimer > 0) return;
  u.modeTimer = 0;
  u.mode = u.mode === "deploying" ? "sieged" : "mobile";
}
