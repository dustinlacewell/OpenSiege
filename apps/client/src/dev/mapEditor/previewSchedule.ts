/** Seconds between previews while the map keeps changing. */
const EVERY = 30;

/**
 * When the loop takes a preview: once the map changed and the last shot is old enough, or on the next frame
 * after `soon`. Pure state, no clock: the loop passes the time.
 */
export class PreviewSchedule {
  private changed = false;
  private last = -Infinity;

  /** The map changed. */
  touch(): void {
    this.changed = true;
  }

  /** Take one on the next frame. */
  soon(): void {
    this.changed = true;
    this.last = -Infinity;
  }

  due(now: number): boolean {
    return this.changed && now - this.last >= EVERY;
  }

  taken(now: number): void {
    this.changed = false;
    this.last = now;
  }
}
