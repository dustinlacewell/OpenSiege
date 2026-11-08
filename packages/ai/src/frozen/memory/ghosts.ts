import type { Contact, Eye, Picture } from "../perception/picture.ts";
import type { Ghost } from "./memory.ts";

/** How long a ghost lasts unseen, in ticks. A factory moves rarely; a deployed unit cannot move at once. */
const TTL_FACTORY = 6000;
const TTL_ANCHORED = 3000;
const TTL_MOBILE = 600;
/** A ghost whose spot is this deep inside some eye's sight, and not sensed, is gone. */
const CLEAR_FRACTION = 0.85;

/** This tick's contacts refresh their ghosts. Unsensed ghosts stay until they expire or their spot is seen empty. */
export function updateGhosts(prev: ReadonlyMap<number, Ghost>, pic: Picture): Map<number, Ghost> {
  const out = new Map<number, Ghost>();
  for (const c of pic.contacts) out.set(c.id, refresh(prev.get(c.id), c, pic.tick));
  for (const g of prev.values()) {
    if (out.has(g.id) || expired(g, pic.tick) || seenEmpty(g, pic.eyes)) continue;
    out.set(g.id, g);
  }
  return out;
}

/** A radar contact keeps the kind, mode and hp from an earlier sighting. */
function refresh(g: Ghost | undefined, c: Contact, tick: number): Ghost {
  return {
    id: c.id,
    owner: c.owner,
    x: c.x,
    y: c.y,
    kind: c.kind ?? g?.kind ?? null,
    mode: c.mode ?? g?.mode ?? null,
    hp: c.hp ?? g?.hp ?? null,
    firstSeen: g?.firstSeen ?? tick,
    lastSeen: tick,
  };
}

function expired(g: Ghost, tick: number): boolean {
  const ttl = g.kind === "factory" ? TTL_FACTORY : g.mode === "sieged" || g.mode === "deploying" ? TTL_ANCHORED : TTL_MOBILE;
  return tick - g.lastSeen > ttl;
}

function seenEmpty(g: Ghost, eyes: readonly Eye[]): boolean {
  return eyes.some((e) => {
    const r = e.sight * CLEAR_FRACTION;
    return (e.x - g.x) ** 2 + (e.y - g.y) ** 2 <= r * r;
  });
}

/** Ghosts in `before` that `after` no longer holds: expired or seen empty this think. */
export function forgottenGhosts(before: ReadonlyMap<number, Ghost>, after: ReadonlyMap<number, Ghost>): Ghost[] {
  return [...before.values()].filter((g) => !after.has(g.id));
}

/** Ghosts old enough to act on (`Knobs.reactionDelay`). */
export function knownGhosts(ghosts: ReadonlyMap<number, Ghost>, tick: number, delay: number): Ghost[] {
  return [...ghosts.values()].filter((g) => tick - g.firstSeen >= delay);
}
