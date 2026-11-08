// How far the mirrored copies of the map reach. Pure.

/** How far the mirrored copies reach from the map, in world units. The haze hides what lies past it. */
export const SURROUND_REACH = 48000;
/** At most this many rings of copies, so a tiny map does not draw hundreds. */
export const MAX_RINGS = 8;

/** Rings of copies that cover SURROUND_REACH past the map's shorter side, at least one. */
export function ringsFor(width: number, height: number): number {
  return Math.max(1, Math.min(MAX_RINGS, Math.ceil(SURROUND_REACH / Math.min(width, height))));
}
