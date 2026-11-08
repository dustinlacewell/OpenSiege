import { UNIT_STATS } from "../stats.ts";
import { isqrt } from "../math.ts";
import { clampX, clampY } from "../mapSize.ts";
import { FEATURE_STATS } from "../features/featureStats.ts";
import { slide } from "../nav/slide.ts";
import type { SimState } from "../simState.ts";
import type { Feature, MapSize, Unit } from "../types.ts";

/**
 * Hard contact with blocking features: a mobile unit whose hull overlaps a rock or boulder is put back on its
 * edge, so it slides around it at its true radius. The nav grid only plans routes in terrain-cell steps; this is
 * what keeps a body off the rock between them. Runs after separation, so a crowd cannot push a unit into a rock.
 * A push never moves a unit into a blocked cell of its class (`nav/slide.ts`).
 */
export function featureContact(state: SimState, m: MapSize): void {
  const near: Feature[] = [];
  for (const u of state.world.units) {
    if (u.mode !== "mobile" || u.hp <= 0) continue;
    const r = UNIT_STATS[u.kind].radius;
    for (const f of state.features.query(u.x, u.y, r, near)) {
      if (FEATURE_STATS[f.kind].blocksMove) pushOff(state, m, u, r, f);
    }
  }
}

function pushOff(state: SimState, m: MapSize, u: Unit, r: number, f: Feature): void {
  const reach = r + f.radius;
  let dx = u.x - f.x, dy = u.y - f.y;
  const d2 = dx * dx + dy * dy;
  if (d2 >= reach * reach) return;
  let d = isqrt(d2);
  if (d === 0) { dx = 1; dy = 0; d = 1; } // Exactly on the centre: out along +x.
  const toX = clampX(m, f.x + Math.trunc((dx * reach) / d));
  const toY = clampY(m, f.y + Math.trunc((dy * reach) / d));
  const p = slide(state.nav.shape, state.nav.grids[UNIT_STATS[u.kind].moveClass], u.x, u.y, toX, toY);
  u.x = p.x;
  u.y = p.y;
}
