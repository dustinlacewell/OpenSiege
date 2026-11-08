import type { Projectile, UnitKind } from "@mf/sim";

/** A shell's last seen state, fixed point. */
export interface ShotState {
  /** The kind of unit that fired it. */
  source: UnitKind;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  splash: number;
  gen: number;
}

/** Remembers every shell in flight so a shell that disappears can be reported with its last state. */
export class ShotTracker {
  private readonly shots = new Map<number, ShotState>();
  private gen = 0;

  /** Call once per new world tick. Reports each shell that is gone since the last call. */
  observe(projectiles: readonly Projectile[], onGone: (s: ShotState) => void): void {
    const gen = ++this.gen;
    for (const p of projectiles) this.record(p, gen);
    for (const [id, s] of this.shots) {
      if (s.gen === gen) continue;
      onGone(s);
      this.shots.delete(id);
    }
  }

  clear(): void {
    this.shots.clear();
  }

  private record(p: Projectile, gen: number): void {
    let s = this.shots.get(p.id);
    if (!s) {
      s = { source: p.source, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, splash: 0, gen };
      this.shots.set(p.id, s);
    }
    s.x = p.x; s.y = p.y; s.z = p.z;
    s.vx = p.vx; s.vy = p.vy; s.vz = p.vz;
    s.splash = p.splash;
    s.gen = gen;
  }
}
