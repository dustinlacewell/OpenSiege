import { UNIT_KINDS } from "./stats.ts";
import type { Blast, Feature, Order, Player, Projectile, ResourceField, Terrain, Unit, World } from "./types.ts";

const FNV_OFFSET = 0x811c9dc5;
const FNV_PRIME = 0x01000193;

/** FNV-1a over bytes, as a uint32 accumulator. */
class Fnv {
  h = FNV_OFFSET;

  byte(b: number): void {
    this.h = Math.imul(this.h ^ (b & 0xff), FNV_PRIME) >>> 0;
  }

  /** Low 32 bits as 4 bytes, then the high part, so values past 2^32 still count. */
  int(n: number): void {
    const lo = n | 0;
    this.byte(lo);
    this.byte(lo >>> 8);
    this.byte(lo >>> 16);
    this.byte(lo >>> 24);
    const hi = Math.floor(n / 0x100000000) | 0;
    if (hi !== 0 && hi !== -1) this.int(hi);
  }

  bool(b: boolean): void {
    this.byte(b ? 1 : 0);
  }

  str(s: string): void {
    this.int(s.length);
    for (let i = 0; i < s.length; i++) this.int(s.charCodeAt(i));
  }
}

/** A uint32 hash of the full world. Equal worlds give equal hashes on every machine. */
export function hashWorld(world: World): number {
  const f = new Fnv();
  f.int(world.tick);
  f.int(world.rng);
  f.int(world.nextId);
  f.int(world.players.length);
  for (const p of world.players) hashPlayer(f, p);
  f.int(world.units.length);
  for (const u of world.units) hashUnit(f, u);
  f.int(world.fields.length);
  for (const r of world.fields) hashField(f, r);
  f.int(world.features.length);
  for (const ft of world.features) hashFeature(f, ft);
  f.int(world.projectiles.length);
  for (const p of world.projectiles) hashProjectile(f, p);
  f.int(world.blasts.length);
  for (const b of world.blasts) hashBlast(f, b);
  hashTerrain(f, world.terrain);
  f.int(world.dug.length);
  for (const d of world.dug) f.int(d);
  return f.h;
}

function hashBlast(f: Fnv, b: Blast): void {
  f.int(b.x);
  f.int(b.y);
  f.int(b.z);
  f.int(b.damage);
  f.int(b.radius);
  f.int(b.dig);
}

function hashFeature(f: Fnv, ft: Feature): void {
  f.int(ft.id);
  f.str(ft.kind);
  f.int(ft.x);
  f.int(ft.y);
  f.int(ft.radius);
  f.int(ft.hp);
  f.int(ft.variant);
  f.str(ft.unit ?? "");
}

function hashProjectile(f: Fnv, p: Projectile): void {
  f.int(p.id);
  f.int(p.owner);
  f.int(p.shooter);
  f.str(p.source);
  f.int(p.x);
  f.int(p.y);
  f.int(p.z);
  f.int(p.vx);
  f.int(p.vy);
  f.int(p.vz);
  f.int(p.damage);
  f.int(p.splash);
  f.int(p.dig);
  f.int(p.ttl);
}

function hashTerrain(f: Fnv, t: Terrain): void {
  f.int(t.cols);
  f.int(t.rows);
  f.int(t.cell);
  f.int(t.seaLevel);
  f.int(t.heights.length);
  for (const h of t.heights) f.int(h);
}

function hashPlayer(f: Fnv, p: Player): void {
  f.int(p.id);
  f.str(p.name);
  f.int(p.color);
  f.int(p.credits);
  f.bool(p.alive);
  f.bool(p.connected);
  f.int(p.team);
}

function hashUnit(f: Fnv, u: Unit): void {
  f.int(u.id);
  f.int(u.owner);
  f.str(u.kind);
  f.int(u.x);
  f.int(u.y);
  f.int(u.facing);
  f.int(u.hp);
  f.str(u.mode);
  f.int(u.modeTimer);
  f.int(u.orders.length);
  for (const o of u.orders) hashOrder(f, o);
  f.int(u.cooldown);
  f.int(u.queue.length);
  for (const j of u.queue) {
    f.int(j.id);
    f.str(j.kind);
    f.int(j.progress);
  }
  f.int(u.lastFired);
  f.int(u.target);
  f.int(u.aim);
  f.int(u.elevation);
  f.int(u.work);
  f.int(u.arrived);
  f.bool(u.rally !== null);
  if (u.rally) {
    f.int(u.rally.x);
    f.int(u.rally.y);
  }
  for (const k of UNIT_KINDS) f.int(u.quota[k] ?? 0);
}

function hashOrder(f: Fnv, o: Order): void {
  f.str(o.type);
  if (o.type === "move") {
    f.int(o.x);
    f.int(o.y);
    f.int(o.group);
    f.bool(o.attack);
    f.int(o.path.length);
    for (const p of o.path) {
      f.int(p.x);
      f.int(p.y);
    }
    f.int(o.best);
    f.int(o.stall);
    f.int(o.skip);
  } else if (o.type === "attack") {
    f.int(o.target);
    f.bool(o.hold);
    f.int(o.x);
    f.int(o.y);
  } else if (o.type === "engage") {
    f.int(o.target);
    f.bool(o.hold);
    f.int(o.x);
    f.int(o.y);
  } else if (o.type === "guard") {
    f.int(o.target);
    f.bool(o.chase);
  } else if (o.type === "reclaim") {
    f.int(o.target);
  } else {
    f.bool(o.on);
  }
}

function hashField(f: Fnv, r: ResourceField): void {
  f.int(r.id);
  f.int(r.x);
  f.int(r.y);
  f.int(r.radius);
  f.int(r.amount);
}
