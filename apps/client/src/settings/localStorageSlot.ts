import type { StorageSlot } from "./settingsStore.ts";

/** A `StorageSlot` over one localStorage key. Every access is guarded: storage can be blocked. */
export function localStorageSlot(key: string): StorageSlot {
  return {
    get() {
      try {
        return localStorage.getItem(key);
      } catch {
        return null;
      }
    },
    set(s) {
      try {
        localStorage.setItem(key, s);
      } catch {
        // Blocked or full: settings last for this session only.
      }
    },
  };
}
