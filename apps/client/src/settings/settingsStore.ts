import { allFields, DEFAULT_SETTINGS, isValidFor, type SettingsValues } from "./settingsModel.ts";

/** One string of persistent storage. May throw. */
export interface StorageSlot {
  get(): string | null;
  set(s: string): void;
}

/** Defaults, with every valid stored value merged over them. Unknown keys and invalid values are dropped. */
export function parseSettings(raw: unknown): SettingsValues {
  const out: Record<string, unknown> = { ...DEFAULT_SETTINGS };
  if (typeof raw !== "object" || raw === null) return out as unknown as SettingsValues;
  const stored = raw as Record<string, unknown>;
  for (const field of allFields()) {
    if (isValidFor(field, stored[field.id])) out[field.id] = stored[field.id];
  }
  return out as unknown as SettingsValues;
}

type Listener = (values: SettingsValues) => void;

/** The current settings, saved on every change. A storage that throws only loses persistence. */
export class SettingsStore {
  private values: SettingsValues;
  private readonly listeners = new Set<Listener>();

  constructor(private readonly slot: StorageSlot) {
    this.values = parseSettings(read(slot));
  }

  get(): SettingsValues {
    return this.values;
  }

  set(patch: Partial<SettingsValues>): void {
    this.values = parseSettings({ ...this.values, ...patch });
    try {
      this.slot.set(JSON.stringify(this.values));
    } catch {
      // Storage is full or blocked: keep the value for this session.
    }
    for (const fn of this.listeners) fn(this.values);
  }

  /** Calls `fn` after every change. Returns the unsubscribe. */
  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => void this.listeners.delete(fn);
  }
}

function read(slot: StorageSlot): unknown {
  try {
    const s = slot.get();
    return s === null ? null : JSON.parse(s);
  } catch {
    return null;
  }
}
