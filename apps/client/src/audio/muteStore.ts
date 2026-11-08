const KEY = "mf.muted";

/** The saved mute choice. False if storage is unavailable. */
export function loadMuted(): boolean {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

/** Saves the mute choice. Ignores storage errors. */
export function saveMuted(muted: boolean): void {
  try {
    localStorage.setItem(KEY, muted ? "1" : "0");
  } catch {
    // Private mode or storage blocked: the choice lasts this page only.
  }
}
