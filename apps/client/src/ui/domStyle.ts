/** Writes only when the class list changed. */
export function setClass(el: HTMLElement, className: string): void {
  if (el.className !== className) el.className = className;
}

/** Writes only when the width changed. */
export function setWidthPct(el: HTMLElement, pct: number): void {
  const w = `${pct}%`;
  if (el.style.width !== w) el.style.width = w;
}
