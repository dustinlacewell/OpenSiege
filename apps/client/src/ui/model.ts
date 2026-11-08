import type { World } from "@mf/sim";
import { BUILD_PAGES, buildSlots, maxQuotas } from "../game/buildGrid.ts";
import { ownFactories, siegeToggle } from "../game/commands.ts";
import { playerById } from "../game/lookup.ts";
import type { TargetKind } from "../game/session.ts";
import type { GuideView } from "../game/tutorial/types.ts";
import {
  commandFlags, guideLine, paletteSlots, queueLocked, type CommandName, type ControlFlags, type GuideLine, type HudGuide, type PaletteSlot,
} from "./guideModel.ts";
import { leaders, type LeaderRow } from "./leaderModel.ts";
import { queueSummary, type QueueSummary } from "./queueModel.ts";
import { selectionView, type SelectionView } from "./selectionModel.ts";

export interface HudModel {
  credits: number;
  unitCount: number;
  /** The selected units: one unit's details, or the tile list. */
  selection: SelectionView;
  hasSelection: boolean;
  hasFactory: boolean;
  /** True when the siege key would deploy (any selected unit is mobile). */
  siegeDeploys: boolean;
  /** The target mode, or null. The command card shows its hint and marks its button. */
  targetMode: TargetKind | null;
  /** Build queue of each selected own factory. */
  queues: QueueSummary;
  /** The guide forbids cancelling a queued job. */
  queueLocked: boolean;
  /** The nine build slots of the shown page, with the guide's lock and focus. */
  palette: PaletteSlot[];
  /** The guide's lock and focus of each action button. */
  commands: Record<CommandName, ControlFlags>;
  /** The tutorial prompt line, or null. */
  guide: GuideLine | null;
  page: number;
  pages: number;
  /** The local player is out. */
  dead: boolean;
  /** Not playing (a spectator or out): a click on a leaderboard row takes that player's view. */
  watching: boolean;
  leaders: LeaderRow[];
}

/** The client view state the HUD reads (`game/session.ts`). */
export interface HudView {
  /** Whose view this is. */
  me: number;
  /** Who the local client is; differs from `me` while a spectator watches a player. */
  self: number;
  selected: readonly number[];
  page: number;
  targetMode: TargetKind | null;
  /** The control group of a unit, or 0. */
  groupOf: (id: number) => number;
  /** What the guide admits. `NO_GUIDE` outside a tutorial. */
  guide: HudGuide;
  /** What the guide shows, or null. */
  guideView: GuideView | null;
}

export function hudModel(world: World, view: HudView): HudModel {
  const { me, selected, page, targetMode } = view;
  const player = playerById(world.players, me);
  const local = playerById(world.players, view.self);
  const factories = ownFactories(world, me, selected);
  const credits = player?.credits ?? 0;
  const queues = queueSummary(factories);
  const hasFactory = factories.length > 0;
  const guided = { world, me, selected, guide: view.guide, view: view.guideView };
  const slots = buildSlots(page, { credits, full: queues.full, hasFactory, quotas: maxQuotas(factories) });
  return {
    credits,
    unitCount: world.units.reduce((n, u) => n + (u.owner === me ? 1 : 0), 0),
    selection: selectionView(world, selected, view.groupOf),
    hasSelection: selected.length > 0,
    hasFactory,
    siegeDeploys: siegeToggle(world, selected, false)?.on ?? true,
    targetMode,
    queues,
    queueLocked: queueLocked(guided),
    palette: paletteSlots(slots, hasFactory, guided),
    commands: commandFlags(guided),
    guide: guideLine(view.guideView),
    page,
    pages: BUILD_PAGES.length,
    dead: local !== undefined && !local.alive,
    watching: !local?.alive,
    leaders: leaders(world, me),
  };
}
