import { PROJ_FP, UNIT_STATS, type UnitKind, type UnitMode, type World } from "@mf/sim";
import type { ShotState } from "../game/shotTracker.ts";
import type { SoundEvent, WorldCue } from "./cues.ts";

/** What one unit looked like after the last step. Only the fields a sound needs. */
export interface UnitMark {
  kind: UnitKind;
  owner: number;
  hp: number;
  mode: UnitMode;
  x: number;
  y: number;
  /** Factory: progress of the head job, or -1 with an empty queue. */
  jobProgress: number;
}

/** The last step's world, reduced to what `diffWorld` compares. */
export interface Marks {
  units: Map<number, UnitMark>;
  credits: number;
}

/** Explosion size of a destroyed unit, 0..1. */
const DEATH_SIZE: Record<UnitKind, number> = { factory: 1, artillery: 0.7, tank: 0.6, harvester: 0.5, radar: 0.45, jammer: 0.45, engineer: 0.4, mine: 0.35 };
/** Splash of the biggest shell; impact sizes are measured against it. */
const MAX_SPLASH = 180;

/** Pure. A copy of what the next `diffWorld` needs, because the sim mutates `World` in place. */
export function markWorld(world: World, me: number): Marks {
  const units = new Map<number, UnitMark>();
  for (const u of world.units) {
    const head = u.queue[0];
    units.set(u.id, { kind: u.kind, owner: u.owner, hp: u.hp, mode: u.mode, x: u.x, y: u.y, jobProgress: head ? head.progress : -1 });
  }
  return { units, credits: world.players.find((p) => p.id === me)?.credits ?? 0 };
}

/**
 * Pure. The events between `before` and `world`, `elapsed` ticks later.
 * `gone` are the shells that vanished (from `ShotTracker`, the same detector `Effects` uses).
 * Shots use the same `lastFired < elapsed` rule as the muzzle flashes.
 */
export function diffWorld(before: Marks, world: World, me: number, elapsed: number, gone: readonly ShotState[], out: SoundEvent[]): void {
  const dead = lost(before, world);
  const bodies = [...world.units, ...dead];
  for (const s of gone) impact(s, bodies, out);
  for (const u of world.units) {
    const own = u.owner === me;
    const was = before.units.get(u.id);
    if (u.lastFired < elapsed) shot(u.kind, u.x, u.y, own, out);
    if (!was) continue;
    if (own && u.hp < was.hp) out.push(event("underAttack", u.x, u.y, false, true, 1));
    if (u.mode !== was.mode && (u.mode === "deploying" || u.mode === "packing")) {
      out.push(event(u.mode === "deploying" ? "deploy" : "pack", u.x, u.y, true, own, 0.5));
    }
    if (own && jobFinished(was.jobProgress, u.queue[0]?.progress)) out.push(event("built", u.x, u.y, false, true, 0.5));
  }
  for (const m of dead) out.push(event("destroyed", m.x, m.y, true, m.owner === me, DEATH_SIZE[m.kind]));
  credits(before, world, me, out);
}

function event(cue: SoundEvent["cue"], x: number, y: number, spatial: boolean, own: boolean, size: number): SoundEvent {
  return { cue, x, y, spatial, own, size };
}

function shot(kind: UnitKind, x: number, y: number, own: boolean, out: SoundEvent[]): void {
  const weapon = UNIT_STATS[kind].weapon;
  if (weapon === "none") return;
  out.push(event(weapon === "ballistic" ? "shotBallistic" : "shotDirect", x, y, true, own, 0.5));
}

/** At the shell's next position, as `Effects.explode` places the flash. */
function impact(s: ShotState, bodies: readonly Body[], out: SoundEvent[]): void {
  const x = (s.x + s.vx) / PROJ_FP;
  const y = (s.y + s.vy) / PROJ_FP;
  out.push(event(impactCue(s.source, x, y, bodies), x, y, true, false, Math.min(1, s.splash / MAX_SPLASH)));
}

/** Where a unit stood and what it is: enough to tell whether a shell burst on it. */
export interface Body {
  kind: UnitKind;
  x: number;
  y: number;
}

/** World units past a unit's hit radius (`UNIT_STATS[kind].radius`, the sim's shell-hit circle) that still count as on it. */
const ARMOR_REACH = 8;

/**
 * Pure. The cue for a shell from a `source` unit that burst at (x, y). The firer's weapon picks the family:
 * ballistic is a shell, any other a round. A body with its centre within its hit radius + ARMOR_REACH picks armor, else ground.
 */
export function impactCue(source: UnitKind, x: number, y: number, bodies: Iterable<Body>): WorldCue {
  const armor = onArmor(x, y, bodies);
  if (UNIT_STATS[source].weapon === "ballistic") return armor ? "shellArmor" : "shellGround";
  return armor ? "roundArmor" : "roundGround";
}

function onArmor(x: number, y: number, bodies: Iterable<Body>): boolean {
  for (const b of bodies) {
    const reach = UNIT_STATS[b.kind].radius + ARMOR_REACH;
    if ((b.x - x) ** 2 + (b.y - y) ** 2 <= reach * reach) return true;
  }
  return false;
}

/** The units in the last marks that are gone now: destroyed this step. */
function lost(before: Marks, world: World): UnitMark[] {
  if (before.units.size === 0) return [];
  const alive = new Set<number>();
  for (const u of world.units) alive.add(u.id);
  const out: UnitMark[] = [];
  for (const [id, m] of before.units) if (!alive.has(id)) out.push(m);
  return out;
}

/** Progress only grows while a job runs. A drop, or an emptied queue, means the head job finished. */
function jobFinished(was: number, now: number | undefined): boolean {
  return was > 0 && (now === undefined || now < was);
}

function credits(before: Marks, world: World, me: number, out: SoundEvent[]): void {
  const now = world.players.find((p) => p.id === me)?.credits ?? 0;
  if (now > before.credits) out.push(event("credits", 0, 0, false, true, 0.2));
}
