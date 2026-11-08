import type { Camera } from "../game/camera.ts";
import type { Cue, SoundEvent, Voice } from "./cues.ts";
import type { GlobalTuning } from "./soundTuning.ts";

/** Where the player listens from: the camera look-at point, with screen right and the hearing range. */
export interface Listener {
  x: number;
  y: number;
  /** Screen right on the ground. */
  rightX: number;
  rightY: number;
  /** Beyond this ground distance a sound is silent. */
  radius: number;
  /** Ground distance from centre to the screen edge, for pan. */
  halfWidth: number;
  /** 0..1. Gain factor for placed sounds, from the camera distance. Zoomed out is quieter. */
  zoom: number;
}

/** True when the player may hear a sound at this ground point. The fog of war plugs in here. */
export type Heard = (x: number, y: number) => boolean;

/** Pan width as a share of the camera distance. About half the visible ground. Geometry, not tuning. */
const HALF_WIDTH_PER_DIST = 0.6;

/** Pure. The listener for this camera. Hearing range and zoom come from the tuning. */
export function listenerOf(cam: Camera, g: GlobalTuning): Listener {
  return {
    x: cam.x,
    y: cam.y,
    rightX: Math.cos(cam.yaw),
    rightY: Math.sin(cam.yaw),
    radius: cam.dist * g.hearingRange,
    halfWidth: cam.dist * HALF_WIDTH_PER_DIST,
    zoom: zoomFactor(cam.dist, g),
  };
}

/** Pure. 1 at or below `zoomNear`, `zoomFloor` at or above `zoomFar`, linear between. */
export function zoomFactor(dist: number, g: GlobalTuning): number {
  if (dist <= g.zoomNear) return 1;
  if (dist >= g.zoomFar) return g.zoomFloor;
  const t = (dist - g.zoomNear) / (g.zoomFar - g.zoomNear);
  return 1 + (g.zoomFloor - 1) * t;
}

/**
 * Pure. Turns one step's events into at most one voice per cue, loudest first.
 * Drops what is out of range or not `heard`. Many events of one cue make one louder voice.
 * Placed sounds are scaled by `ear.zoom`; alerts and economy sounds are not.
 */
export function mixEvents(events: readonly SoundEvent[], ear: Listener, heard: Heard, g: GlobalTuning): Voice[] {
  const byCue = new Map<Cue, { voice: Voice; count: number }>();
  for (const e of events) {
    const v = place(e, ear, heard);
    if (!v) continue;
    const merged = byCue.get(v.cue);
    if (!merged) byCue.set(v.cue, { voice: v, count: 1 });
    else merge(merged, v);
  }
  const out: Voice[] = [];
  for (const { voice, count } of byCue.values()) {
    voice.gain = Math.min(g.maxGain, voice.gain * (1 + g.mergeBoost * Math.log2(count)));
    out.push(voice);
  }
  return out.sort((a, b) => b.gain - a.gain);
}

/** Gain falls with the square of the distance share and with the zoom factor; pan follows screen x. */
function place(e: SoundEvent, ear: Listener, heard: Heard): Voice | null {
  if (!e.spatial) return { cue: e.cue, gain: 1, pan: 0, size: e.size };
  if (!e.own && !heard(e.x, e.y)) return null;
  const dx = e.x - ear.x;
  const dy = e.y - ear.y;
  const near = 1 - Math.hypot(dx, dy) / ear.radius;
  if (near <= 0) return null;
  const pan = Math.max(-1, Math.min(1, (dx * ear.rightX + dy * ear.rightY) / ear.halfWidth));
  return { cue: e.cue, gain: near * near * ear.zoom, pan, size: e.size };
}

/** Keeps the loudest event's pan, the biggest size. */
function merge(into: { voice: Voice; count: number }, v: Voice): void {
  into.count++;
  if (v.gain > into.voice.gain) {
    into.voice.gain = v.gain;
    into.voice.pan = v.pan;
  }
  into.voice.size = Math.max(into.voice.size, v.size);
}
