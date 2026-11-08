// What Esc does. Pure.

export interface EscapeState {
  settingsOpen: boolean;
  pauseOpen: boolean;
  /** A match is running (not landing, pick or the end card). */
  inMatch: boolean;
}

export type EscapeAction = "closeSettings" | "resume" | "pause" | "none";

/** The settings modal closes first, then the pause overlay; with neither open, a running match pauses. */
export function escapeAction(s: EscapeState): EscapeAction {
  if (s.settingsOpen) return "closeSettings";
  if (s.pauseOpen) return "resume";
  return s.inMatch ? "pause" : "none";
}
