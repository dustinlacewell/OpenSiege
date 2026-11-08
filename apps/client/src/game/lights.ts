/** Most lights the lit shaders take in one frame. */
export const MAX_LIGHTS = 512;
/** Three vec4 per light: [A, radius], [B, 0], [rgb, 0]. */
export const FLOATS_PER_LIGHT = 12;
/** Floats in a packed buffer for MAX_LIGHTS lights. */
export const LIGHT_BUFFER_FLOATS = MAX_LIGHTS * FLOATS_PER_LIGHT;

/** "decay": a fast fall from full. "hold": full for a fraction of the life, then a straight ramp to 0. */
export type LightCurve = "decay" | "hold";

/** What `pack` asks to cull lights the local player does not see. */
export interface LightVision {
  sees(x: number, y: number): boolean;
}

/** A capsule light from A to B (A == B is a point light). Radiance is linear HDR. */
interface Light {
  ax: number;
  ay: number;
  az: number;
  bx: number;
  by: number;
  bz: number;
  /** World units where the light reaches 0. */
  radius: number;
  r: number;
  g: number;
  b: number;
  /** Seconds. Held lights keep life 0. */
  age: number;
  life: number;
  curve: LightCurve;
  /** For "hold": the part of the life at full strength. */
  holdFor: number;
  /** Set by `pack`. */
  fade: number;
  strength: number;
}

/**
 * Timed lights (flashes) age and die. Held lights (beams) live one frame: the caller holds them again
 * each frame after `beginFrame`.
 */
export class LightPool {
  private readonly timed = new Slots();
  private readonly held = new Slots();
  private readonly ranked: Light[] = [];

  /** A point light at (x, y, z) that fades over `life` seconds. */
  spawn(x: number, y: number, z: number, radius: number, rgb: readonly number[], life: number, curve: LightCurve, holdFor = 0.5): void {
    const l = this.timed.take();
    place(l, x, y, z, x, y, z, radius, rgb);
    l.age = 0;
    l.life = life;
    l.curve = curve;
    l.holdFor = holdFor;
  }

  /** A capsule light from A to B for this frame only, at full strength. */
  hold(ax: number, ay: number, az: number, bx: number, by: number, bz: number, radius: number, rgb: readonly number[]): void {
    const l = this.held.take();
    place(l, ax, ay, az, bx, by, bz, radius, rgb);
    l.age = 0;
    l.life = 0;
  }

  /** Drops last frame's held lights. */
  beginFrame(): void {
    this.held.count = 0;
  }

  /** Ages the timed lights and drops the dead. */
  advance(dt: number): void {
    const t = this.timed;
    let i = 0;
    while (i < t.count) {
      const l = t.items[i]!;
      l.age += dt;
      if (l.age >= l.life) t.remove(i);
      else i++;
    }
  }

  clear(): void {
    this.timed.count = 0;
    this.held.count = 0;
  }

  /** Writes the strongest `max` seen lights into `out`, strongest first, rgb pre-multiplied by the fade. Returns how many. */
  pack(out: Float32Array, vision: LightVision, max = MAX_LIGHTS): number {
    const ranked = this.rank(vision);
    const n = Math.min(max, ranked.length, Math.floor(out.length / FLOATS_PER_LIGHT));
    for (let i = 0; i < n; i++) write(out, i * FLOATS_PER_LIGHT, ranked[i]!);
    return n;
  }

  /** Seen, lit lights, strongest first. */
  private rank(vision: LightVision): Light[] {
    const ranked = this.ranked;
    ranked.length = 0;
    addSeen(this.timed, vision, ranked);
    addSeen(this.held, vision, ranked);
    return ranked.sort(strongestFirst);
  }
}

function addSeen(slots: Slots, vision: LightVision, out: Light[]): void {
  for (let i = 0; i < slots.count; i++) {
    const l = slots.items[i]!;
    l.fade = fadeOf(l);
    l.strength = Math.max(l.r, l.g, l.b) * l.fade * l.radius;
    if (l.strength > 0 && vision.sees((l.ax + l.bx) / 2, (l.ay + l.by) / 2)) out.push(l);
  }
}

function strongestFirst(a: Light, b: Light): number {
  return b.strength - a.strength;
}

/** Swap-remove storage: `items[0..count)` are alive, the rest are reused. */
class Slots {
  readonly items: Light[] = [];
  count = 0;

  take(): Light {
    let l = this.items[this.count];
    if (!l) {
      l = { ax: 0, ay: 0, az: 0, bx: 0, by: 0, bz: 0, radius: 1, r: 0, g: 0, b: 0, age: 0, life: 0, curve: "decay", holdFor: 0, fade: 1, strength: 0 };
      this.items.push(l);
    }
    this.count++;
    return l;
  }

  remove(i: number): void {
    const last = this.count - 1;
    const dead = this.items[i]!;
    this.items[i] = this.items[last]!;
    this.items[last] = dead;
    this.count = last;
  }
}

function place(l: Light, ax: number, ay: number, az: number, bx: number, by: number, bz: number, radius: number, rgb: readonly number[]): void {
  l.ax = ax; l.ay = ay; l.az = az;
  l.bx = bx; l.by = by; l.bz = bz;
  l.radius = radius;
  l.r = rgb[0]!; l.g = rgb[1]!; l.b = rgb[2]!;
}

/** 1 at full strength, 0 dead. Held lights are always 1. */
export function fadeOf(l: { age: number; life: number; curve: LightCurve; holdFor: number }): number {
  if (l.life <= 0) return 1;
  const u = Math.min(1, l.age / l.life);
  if (l.curve === "decay") return (1 - u) ** 3;
  if (u <= l.holdFor) return 1;
  return Math.max(0, 1 - (u - l.holdFor) / (1 - l.holdFor));
}

function write(out: Float32Array, o: number, l: Light): void {
  out[o] = l.ax; out[o + 1] = l.ay; out[o + 2] = l.az; out[o + 3] = l.radius;
  out[o + 4] = l.bx; out[o + 5] = l.by; out[o + 6] = l.bz; out[o + 7] = 0;
  out[o + 8] = l.r * l.fade; out[o + 9] = l.g * l.fade; out[o + 10] = l.b * l.fade; out[o + 11] = 0;
}
