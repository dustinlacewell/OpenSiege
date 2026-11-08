/** A binary min-heap of (key, cell) pairs for Dijkstra and A*. Stale entries are the caller's to skip. */
export class MinHeap {
  private keys: number[] = [];
  private cells: number[] = [];

  get size(): number {
    return this.keys.length;
  }

  push(key: number, cell: number): void {
    const k = this.keys, c = this.cells;
    let i = k.length;
    k.push(key);
    c.push(cell);
    while (i > 0) {
      const up = (i - 1) >> 1;
      if (k[up]! <= key) break;
      k[i] = k[up]!;
      c[i] = c[up]!;
      i = up;
    }
    k[i] = key;
    c[i] = cell;
  }

  /** The cell with the smallest key, and that key. Call only when `size > 0`. */
  pop(): { key: number; cell: number } {
    const k = this.keys, c = this.cells;
    const top = { key: k[0]!, cell: c[0]! };
    const lastK = k.pop()!, lastC = c.pop()!;
    if (k.length > 0) {
      let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = l + 1;
        let m = i, mk = lastK;
        if (l < k.length && k[l]! < mk) { m = l; mk = k[l]!; }
        if (r < k.length && k[r]! < mk) { m = r; mk = k[r]!; }
        if (m === i) break;
        k[i] = k[m]!;
        c[i] = c[m]!;
        i = m;
      }
      k[i] = lastK;
      c[i] = lastC;
    }
    return top;
  }
}
