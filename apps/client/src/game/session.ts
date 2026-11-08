import type { Player, Terrain, World } from "@mf/sim";
import { emptyGroups, type Groups, type Recall } from "./controlGroups.ts";
import type { ReclaimArea } from "./areaReclaim.ts";
import type { Curve } from "./curve.ts";
import type { GroundBox } from "./groundBox.ts";
import type { Lockstep } from "./lockstep.ts";
import { playerById } from "./lookup.ts";
import { pruneDead } from "./selection.ts";

/** What the next left click picks: a unit to guard, or a ground point to attack-move to. */
export type TargetKind = "guard" | "attackMove";

/** The running game as this client sees it: its lockstep, its player id, its selection, its control groups. */
export class Session {
  lockstep: Lockstep | null = null;
  /** The player id whose view this is: vision, selection, HUD. Equal to `self` unless a spectator watches another player. */
  me = -1;
  /** The player id this client really is (0 for a spectator). Intents go out only while `me` equals it. */
  self = -1;
  /** Dev sandbox: this client commands every side and picks one from the leaderboard. Cleared by `stop`. */
  sandbox = false;
  /** True once the camera has jumped to the local player's first factory. */
  homed = false;
  /** Build palette page shown, and the one the grid keys use. */
  buildPage = 0;
  /** The right-drag curve move being drawn, or null. */
  curve: Curve | null = null;
  /** The right-drag area reclaim being drawn, or null. */
  area: ReclaimArea | null = null;
  /** The pending target mode: the next left click picks its target. null = none. */
  targetMode: TargetKind | null = null;
  /** Guard mode: the own unit under the cursor that a click would guard, or 0. */
  guardHover = 0;
  /** The selection box being dragged on the ground, or null. */
  box: GroundBox | null = null;
  /** Units inside `box`: highlighted, not yet selected. */
  boxPreview: ReadonlySet<number> = new Set();
  /** Control groups 1..9 (`controlGroups.ts`). Client view state only, never sent. */
  groups: Groups = emptyGroups();
  /** The last group recall, for the double-tap that centres the camera. */
  lastRecall: Recall | null = null;
  /** The choose-your-start phase's world (terrain, no players), or null. Never set together with `lockstep`. */
  pickWorld: World | null = null;
  private ids: readonly number[] = [];
  private set = new Set<number>();

  start(me: number, lockstep: Lockstep): void {
    this.me = me;
    this.self = me;
    this.lockstep = lockstep;
    this.pickWorld = null;
    this.reset();
  }

  /** The pick phase: there is a world to look at and click on, but no match yet. */
  startPick(me: number, world: World): void {
    this.stop();
    this.me = me;
    this.self = me;
    this.pickWorld = world;
  }

  stop(): void {
    this.lockstep = null;
    this.pickWorld = null;
    this.me = -1;
    this.self = -1;
    this.sandbox = false;
    this.reset();
  }

  /** The name of the player this client is, or "" when it is none. */
  get selfName(): string {
    const w = this.world;
    return (w && playerById(w.players, this.self)?.name) || "";
  }

  /** Not playing: a spectator, or a player who is out. Only then may the view change. */
  get watching(): boolean {
    const w = this.world;
    return w !== null && !playerById(w.players, this.self)?.alive;
  }

  /** Watching with the whole map shown: not looking through any player's eyes. */
  get overview(): boolean {
    return this.watching && this.me === this.self;
  }

  /** Looking through another player's eyes. Intents are not sent then. */
  get viewing(): boolean {
    return this.me !== this.self;
  }

  /** A watcher takes this player's view, or back to the overview with `null`. Clears the selection and recentres the camera. */
  viewAs(id: number | null): void {
    if (!this.watching) return;
    this.me = id ?? this.self;
    this.reset();
  }

  /** Dev sandbox: command and see as player `id`. Clears the selection and groups; the camera stays. */
  takeSide(id: number): void {
    this.me = id;
    this.self = id;
    const homed = this.homed;
    this.reset();
    this.homed = homed;
  }

  /** Leaves any target mode. */
  endTarget(): void {
    this.targetMode = null;
    this.guardHover = 0;
  }

  /** Drops the selection box and its preview. */
  clearBox(): void {
    this.box = null;
    this.boxPreview = new Set();
  }

  private reset(): void {
    this.homed = false;
    this.curve = null;
    this.area = null;
    this.clearBox();
    this.groups = emptyGroups();
    this.lastRecall = null;
    this.endTarget();
    this.select([]);
  }

  get world(): World | null {
    return this.lockstep?.world ?? null;
  }

  /** The ground the camera and the mouse work on: the match's, or the pick phase's. */
  get terrain(): Terrain | null {
    return (this.lockstep?.world ?? this.pickWorld)?.terrain ?? null;
  }

  get player(): Player | undefined {
    const w = this.world;
    return w ? playerById(w.players, this.me) : undefined;
  }

  get selected(): readonly number[] {
    return this.ids;
  }

  get selectedSet(): ReadonlySet<number> {
    return this.set;
  }

  select(ids: readonly number[]): void {
    this.ids = ids;
    this.set = new Set(ids);
    if (ids.length === 0) this.endTarget(); // a target mode needs a selection; its hint is hidden without one
  }

  /** Call once per frame after stepping. */
  pruneSelection(): void {
    const w = this.world;
    if (!w) return;
    const next = pruneDead(this.ids, w.units);
    if (next !== this.ids) this.select(next);
  }
}
