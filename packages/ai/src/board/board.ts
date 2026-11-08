import { groupGhosts, type EnemyGroup } from "../assess/groups.ts";
import { fitsMap } from "../danger/grid.ts";
import { liveDanger } from "../danger/live.ts";
import type { Danger } from "../danger/query.ts";
import { emptyScar, updateScar, type Scar } from "../danger/scar.ts";
import type { Knobs } from "../knobs.ts";
import { knownGhosts } from "../memory/ghosts.ts";
import type { Ghost, Memory } from "../memory/memory.ts";
import type { Ally, Picture } from "../perception/picture.ts";
import type { MapStudy } from "../terrain/study.ts";
import { approaches, type Approach } from "./approaches.ts";
import { releaseEvents, type Events } from "./delay.ts";
import { keepRecent } from "./recent.ts";
import { fieldStates, type FieldState } from "./fields.ts";
import { hurtEvents, type Hurt, type Loss } from "./hurt.ts";

/** The one shared view for a think. A pure function of the picture and memory. The commander and the plan requests read it. */
export interface Board {
  pic: Picture;
  /** Ghosts old enough to react to. */
  known: readonly Ghost[];
  groups: readonly EnemyGroup[];
  allies: readonly Ally[];
  danger: Danger;
  /** Hurt and loss events past the reaction delay. */
  hurts: readonly Hurt[];
  losses: readonly Loss[];
  /** Events released in the last `RECENT` ticks, this think's included. */
  recent: Events;
  fields: readonly FieldState[];
  approaches: readonly Approach[];
  /** The map study, made once per match (`terrain/study.ts`). */
  study: MapStudy;
}

/** The memory slices the board owns. */
export type BoardMemory = Pick<Memory, "lastHp" | "pendingEvents" | "recentEvents" | "scar" | "scarTick">;

/** Known ghosts and groups, events past the delay, the danger map with its new scar, then fields and approaches. `forgotten`: ghosts memory dropped this think. `study`: the match's map study, passed through. */
export function buildBoard(pic: Picture, mem: Memory, knobs: Knobs, forgotten: readonly Ghost[], study: MapStudy): { board: Board; memory: BoardMemory } {
  const known = knownGhosts(mem.ghosts, pic.tick, knobs.reactionDelay);
  const fresh = hurtEvents(mem.lastHp, pic.own, pic.tick);
  const events = releaseEvents(mem.pendingEvents, fresh, pic.tick, knobs.reactionDelay);
  const live = liveDanger(known, pic.map);
  const scar = updateScar(scarOf(mem, pic), { forgotten, known, ...events.ready, eyes: pic.eyes, live }, knobs.danger, pic.tick - mem.scarTick);
  const danger: Danger = { live, scar };
  const recent = keepRecent(mem.recentEvents, events.ready, pic.tick, knobs.reactionDelay);
  const board: Board = {
    pic,
    known,
    groups: groupGhosts(known, pic.map),
    allies: pic.allies,
    danger,
    hurts: events.ready.hurts,
    losses: events.ready.losses,
    recent,
    fields: fieldStates(pic.fields, pic.own, pic.allies, danger),
    approaches: approaches(pic.own, pic.fields, danger),
    study,
  };
  return { board, memory: { lastHp: fresh.nextHp, pendingEvents: events.pending, recentEvents: recent, scar, scarTick: pic.tick } };
}

/** The remembered scar, or an empty one on the first think or a new map size. */
function scarOf(mem: Memory, pic: Picture): Scar {
  return mem.scar && fitsMap(mem.scar.sight, pic.map) ? mem.scar : emptyScar(pic.map);
}
