/** One edited height. Holds both sides so a stroke can be undone. */
export interface HeightChange {
  index: number;
  before: number;
  after: number;
}

/** Write one side of each change into `heights`. */
export function applyChanges(heights: number[], changes: readonly HeightChange[], side: "before" | "after"): void {
  for (const c of changes) heights[c.index] = c[side];
}
