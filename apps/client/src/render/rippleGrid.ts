/** World units per ripple texel when the cap does not bind. */
export const RIPPLE_TEXEL = 16;

/** Most texels on the long side of the ripple field. */
export const RIPPLE_MAX_SIDE = 1024;

/** The ripple field's texel grid over a map: `cols` by `rows` texels, each `texelX` by `texelY` world units. */
export interface RippleGrid {
  cols: number;
  rows: number;
  texelX: number;
  texelY: number;
}

/**
 * Pure. One texel per RIPPLE_TEXEL world units. When the long side would pass min(RIPPLE_MAX_SIDE, maxSide),
 * the texels grow so it fits; both sides use the same texel size before rounding.
 */
export function rippleGrid(width: number, height: number, maxSide = RIPPLE_MAX_SIDE): RippleGrid {
  const cap = Math.max(1, Math.min(RIPPLE_MAX_SIDE, maxSide));
  const texel = Math.max(RIPPLE_TEXEL, Math.max(width, height) / cap);
  const cols = side(width, texel, cap);
  const rows = side(height, texel, cap);
  return { cols, rows, texelX: width / cols, texelY: height / rows };
}

function side(extent: number, texel: number, cap: number): number {
  return Math.max(1, Math.min(cap, Math.ceil(extent / texel - 1e-9)));
}
