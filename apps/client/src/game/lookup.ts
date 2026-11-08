import type { Feature, Player, Unit } from "@mf/sim";

/** Binary search: the sim keeps units sorted by id. */
export function unitById(units: readonly Unit[], id: number): Unit | undefined {
  return byId(units, id);
}

/** Binary search: the sim keeps players sorted by id. */
export function playerById(players: readonly Player[], id: number): Player | undefined {
  return byId(players, id);
}

/** Binary search: the sim keeps features sorted by id. */
export function featureById(features: readonly Feature[], id: number): Feature | undefined {
  return byId(features, id);
}

function byId<T extends { id: number }>(items: readonly T[], id: number): T | undefined {
  let lo = 0;
  let hi = items.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const item = items[mid]!;
    if (item.id === id) return item;
    if (item.id < id) lo = mid + 1;
    else hi = mid - 1;
  }
  return undefined;
}
