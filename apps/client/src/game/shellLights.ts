import type { Projectile } from "@mf/sim";
import { shotAt, type PrevShot, type WorldPoint } from "./interp.ts";
import type { LightPool } from "./lights.ts";

/** A shell's own glow on what it flies over. */
const SHELL_RADIUS = 70;
const SHELL_RGB: readonly number[] = [2.0, 1.4, 0.7];

const at: WorldPoint = { x: 0, y: 0, z: 0 };

/** Holds one small warm point light per shell in flight, where `ProjectilesPass` draws it. Call after `beginFrame`. */
export function holdShellLights(lights: LightPool, shots: readonly Projectile[], prev: ReadonlyMap<number, PrevShot>, alpha: number): void {
  for (const s of shots) {
    const p = shotAt(at, s, prev.get(s.id), alpha);
    lights.hold(p.x, p.y, p.z, p.x, p.y, p.z, SHELL_RADIUS, SHELL_RGB);
  }
}
