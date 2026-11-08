import { BUILDABLE, TICK_MS, UNIT_KINDS, UNIT_STATS, type Unit, type UnitKind } from "@mf/sim";

/** Slots per page: 3 by 3, row-major. */
export const GRID_SLOTS = 9;

/** Build palette pages. Page 0: economy on the top row, combat and the radar truck on the middle row, mine and jammer below. */
export const BUILD_PAGES: readonly (readonly (UnitKind | null)[])[] = [
  [
    "harvester", "engineer", "factory",
    "tank", "artillery", "radar",
    "mine", "jammer", null,
  ],
];

/** Physical key of each slot (`KeyboardEvent.code`), row-major: the left-hand Q W E / A S D / Z X C block. */
export const GRID_KEYS = ["KeyQ", "KeyW", "KeyE", "KeyA", "KeyS", "KeyD", "KeyZ", "KeyX", "KeyC"] as const;
/** The letter printed on each slot. */
export const GRID_LETTERS: readonly string[] = GRID_KEYS.map((code) => code.slice(3));

/** One palette slot as the HUD draws it. */
export interface GridSlot {
  kind: UnitKind | null;
  cost: number;
  /** Build time at one progress per tick. */
  seconds: number;
  key: string;
  enabled: boolean;
  /** Highest quota for this kind over the selected factories. 0 = none set. */
  quota: number;
}

/** What the palette depends on. */
export interface PaletteInput {
  credits: number;
  /** No selected factory can take another job. */
  full: boolean;
  hasFactory: boolean;
  /** Highest quota per kind over the selected factories (`maxQuotas`). */
  quotas: Partial<Record<UnitKind, number>>;
}

/** Highest quota per kind over `factories`. Kinds no factory has a quota for are absent. */
export function maxQuotas(factories: readonly Pick<Unit, "quota">[]): Partial<Record<UnitKind, number>> {
  const out: Partial<Record<UnitKind, number>> = {};
  for (const f of factories) {
    for (const k of UNIT_KINDS) {
      const q = f.quota[k] ?? 0;
      if (q > (out[k] ?? 0)) out[k] = q;
    }
  }
  return out;
}

checkPages();

/** Slot index of a key code, or -1. */
export function gridSlotOf(code: string): number {
  return (GRID_KEYS as readonly string[]).indexOf(code);
}

export function slotKind(page: number, slot: number): UnitKind | null {
  return BUILD_PAGES[page]?.[slot] ?? null;
}

/** The nine slots of `page`. With no factory selected every slot is empty. */
export function buildSlots(page: number, input: PaletteInput): GridSlot[] {
  return Array.from({ length: GRID_SLOTS }, (_, i) => {
    const kind = input.hasFactory ? slotKind(page, i) : null;
    const s = kind ? UNIT_STATS[kind] : null;
    return {
      kind,
      cost: s?.cost ?? 0,
      seconds: s ? (s.buildTicks * TICK_MS) / 1000 : 0,
      key: GRID_LETTERS[i]!,
      enabled: s !== null && !input.full && input.credits >= s.cost,
      quota: kind ? input.quotas[kind] ?? 0 : 0,
    };
  });
}

/** BUILDABLE in the sim decides what may be built. Every page is full size and holds only buildable kinds. */
function checkPages(): void {
  for (const page of BUILD_PAGES) {
    if (page.length !== GRID_SLOTS) throw new Error(`build page has ${page.length} slots, not ${GRID_SLOTS}`);
    for (const kind of page) if (kind && !BUILDABLE.includes(kind)) throw new Error(`${kind} is not buildable`);
  }
}
