import { buildGrid, detect, isEnemy, mapSize, UNIT_KINDS, UNIT_STATS, type MapSize, type ResourceField, type Unit, type UnitKind, type UnitMode, type World } from "@mf/sim";

/** An enemy the bot knows about this tick. A radar contact has a place but no kind. */
export interface Contact {
  id: number;
  owner: number;
  x: number;
  y: number;
  kind: UnitKind | null;
  mode: UnitMode | null;
  hp: number | null;
  seen: boolean;
}

/** Where an own unit looks from, and how far. */
export interface Eye {
  x: number;
  y: number;
  sight: number;
}

/** What the bot knows at one tick. Built fresh each think; nothing here is remembered. */
export interface Picture {
  tick: number;
  me: number;
  alive: boolean;
  credits: number;
  own: readonly Readonly<Unit>[];
  mine: Readonly<Record<UnitKind, readonly Readonly<Unit>[]>>;
  contacts: readonly Contact[];
  eyes: readonly Eye[];
  fields: readonly Readonly<ResourceField>[];
  map: MapSize;
}

/** Own units, the enemies they see or sense on radar, and the public map facts. Reads `world`, never writes it. */
export function perceive(world: Readonly<World>, me: number): Picture {
  const player = world.players.find((p) => p.id === me);
  const own = world.units.filter((u) => u.owner === me && u.hp > 0);
  return {
    tick: world.tick,
    me,
    alive: player?.alive ?? false,
    credits: player?.credits ?? 0,
    own,
    mine: byKind(own),
    contacts: sense(world, me),
    eyes: own.map((u) => ({ x: u.x, y: u.y, sight: UNIT_STATS[u.kind].sight })),
    fields: world.fields,
    map: mapSize(world.terrain),
  };
}

function byKind(own: readonly Readonly<Unit>[]): Record<UnitKind, Readonly<Unit>[]> {
  const out = Object.fromEntries(UNIT_KINDS.map((k) => [k, [] as Readonly<Unit>[]])) as Record<UnitKind, Readonly<Unit>[]>;
  for (const u of own) out[u.kind].push(u);
  return out;
}

/** Each living enemy (not an ally, not own) at its sim detection level: seen, a radar contact, or unknown. */
function sense(world: Readonly<World>, me: number): Contact[] {
  const out: Contact[] = [];
  const detection = detect(world, buildGrid(world.units, mapSize(world.terrain)));
  for (const e of world.units) {
    if (!isEnemy(world.players, me, e.owner) || e.hp <= 0) continue;
    const level = detection.level(me, e);
    if (level === "seen") out.push({ id: e.id, owner: e.owner, x: e.x, y: e.y, kind: e.kind, mode: e.mode, hp: e.hp, seen: true });
    else if (level === "radar") out.push({ id: e.id, owner: e.owner, x: e.x, y: e.y, kind: null, mode: null, hp: null, seen: false });
  }
  return out;
}
