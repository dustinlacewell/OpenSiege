/**
 * Pure bookkeeping of pending requests, at most `cap` at once. Each accepted request gets a fresh id;
 * `take` hands its value back once and frees the place.
 */
export class InFlight<T> {
  private readonly pending = new Map<number, T>();
  private readonly cap: number;
  private nextId = 0;

  constructor(cap: number) {
    this.cap = cap;
  }

  get size(): number {
    return this.pending.size;
  }

  /** The new request's id, or null when `cap` requests are already pending. */
  add(value: T): number | null {
    if (this.pending.size >= this.cap) return null;
    const id = this.nextId++;
    this.pending.set(id, value);
    return id;
  }

  /** The value of request `id`, removed. Undefined when `id` is not pending. */
  take(id: number): T | undefined {
    const value = this.pending.get(id);
    this.pending.delete(id);
    return value;
  }

  /** Forgets every pending request. */
  clear(): void {
    this.pending.clear();
  }
}
