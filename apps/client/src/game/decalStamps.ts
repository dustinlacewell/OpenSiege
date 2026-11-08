/** A scorch to burn into the ground's decal map. World units. */
export interface DecalStamp {
  x: number;
  y: number;
  radius: number;
  /** 0..1, picks the ragged edge's noise and rotation. */
  seed: number;
}

/** What the drain asks of vision. */
export interface Sight {
  sees(x: number, y: number): boolean;
}

/** Scorches waiting to be stamped. The renderer drains the queue once per frame. */
export class DecalStamps {
  private items: DecalStamp[] = [];

  get count(): number {
    return this.items.length;
  }

  push(stamp: DecalStamp): void {
    this.items.push(stamp);
  }

  /** Empties the queue and passes on each stamp the local player sees. */
  drain(sight: Sight, visit: (s: DecalStamp) => void): void {
    const items = this.items;
    this.items = [];
    for (const s of items) if (sight.sees(s.x, s.y)) visit(s);
  }

  clear(): void {
    this.items = [];
  }
}
