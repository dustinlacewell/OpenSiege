import { mapSize } from "@mf/sim";
import * as commands from "../../game/commands.ts";
import { addSample, emptyCurve } from "../../game/curve.ts";
import { scrapAt } from "../../game/scrapPick.ts";
import type { ActionContext } from "./context.ts";

/** World units of pick tolerance around a scrap's circle. */
const SCRAP_SLACK = 8;
/** World units. An area reclaim circle smaller than this reclaims only the press wreck. */
const MIN_AREA_RADIUS = 16;

/** Orders for the selected units: right-click, curve move, area reclaim, siege, stop. */
export interface CommandActions {
  /**
   * Right-click. `rally` sets the rally point of selected own factories, else falls back to a plain command.
   * On scrap with no enemy under the cursor, selected own engineers reclaim it and the others move there.
   */
  command(sx: number, sy: number, mods: commands.CommandMods, rally: boolean): void;
  /** Right-drag: adds the ground point under the cursor to the curve move. Nothing without a selection. */
  curveTo(sx: number, sy: number): void;
  /** Right-drag release: moves the selection along the curve, then clears it. Under 2 path points: a plain move. */
  commandCurve(mods: commands.CommandMods): void;
  /**
   * Right-drag start: begins an area reclaim when an own engineer is selected and the press point is on scrap.
   * False otherwise: the drag is then a curve move.
   */
  areaStart(sx: number, sy: number): boolean;
  /** Area reclaim drag: the circle's radius reaches the ground point under the cursor. */
  areaTo(sx: number, sy: number): void;
  /** Area reclaim release: the selected engineers reclaim the scrap in the circle, then it clears. A tiny circle reclaims the press wreck only. */
  commandArea(mods: commands.CommandMods): void;
  /** Esc or window blur: clears the curve and the area, with no order. True when a curve or an area was being drawn. */
  cancelDrag(): boolean;
  /** The count of drag cancels. The pointer ignores the rest of a right drag when this count changes after its press. */
  dragCancels(): number;
  siege(queue: boolean): void;
  stop(): void;
}

export function commandActions(ctx: ActionContext): CommandActions {
  const { session, send, emit, pickAt, groundPoint, enemy } = ctx;
  let cancels = 0;
  return {
    command(sx, sy, mods, rally) {
      const w = session.world;
      const g = groundPoint(sx, sy);
      if (!w || !g) return;
      const toRally = rally ? commands.rallyAt(w, session.me, session.selected, g[0]!, g[1]!) : null;
      if (toRally) return send(toRally);
      const x = g[0]!, y = g[1]!;
      const target = pickAt(sx, sy, enemy);
      const scrap = target ? undefined : scrapAt(w.features, x, y, SCRAP_SLACK);
      const toScrap = scrap ? commands.reclaim(w, session.me, session.selected, scrap.id, mods.queue) : null;
      if (!toScrap) return emit(commands.commandAt(session.selected, target, x, y, mods));
      // Engineers reclaim; the rest of the selection moves to the point.
      send(toScrap);
      emit(commands.commandAt(session.selected.filter((id) => !toScrap.units.includes(id)), undefined, x, y, mods));
    },
    curveTo(sx, sy) {
      const w = session.world;
      if (!w || session.selected.length === 0) return;
      const g = groundPoint(sx, sy);
      if (g) session.curve = addSample(session.curve ?? emptyCurve(), g[0]!, g[1]!, session.selected.length, mapSize(w.terrain));
    },
    commandCurve(mods) {
      const curve = session.curve;
      session.curve = null;
      const end = curve?.path[curve.path.length - 1];
      if (!curve || !end) return;
      // A drag too short to make a path is a plain move to where it ended.
      if (curve.path.length < 2) emit(commands.commandAt(session.selected, undefined, end.x, end.y, mods));
      else emit(commands.pathMove(session.selected, curve.path, mods));
    },
    areaStart(sx, sy) {
      const w = session.world;
      const g = groundPoint(sx, sy);
      if (!w || !g || !commands.hasEngineer(w, session.me, session.selected)) return false;
      const scrap = scrapAt(w.features, g[0]!, g[1]!, SCRAP_SLACK);
      if (scrap) session.area = { x: g[0]!, y: g[1]!, radius: 0, press: scrap.id };
      return scrap !== undefined;
    },
    areaTo(sx, sy) {
      const area = session.area;
      const g = groundPoint(sx, sy);
      if (area && g) session.area = { ...area, radius: Math.hypot(g[0]! - area.x, g[1]! - area.y) };
    },
    commandArea(mods) {
      const w = session.world;
      const area = session.area;
      session.area = null;
      if (!w || !area) return;
      if (area.radius < MIN_AREA_RADIUS) return emit(commands.reclaim(w, session.me, session.selected, area.press, mods.queue));
      for (const intent of commands.areaReclaim(w, session.me, session.selected, area.x, area.y, area.radius, mods.queue)) send(intent);
    },
    cancelDrag() {
      const was = session.curve !== null || session.area !== null;
      session.curve = null;
      session.area = null;
      cancels++;
      return was;
    },
    dragCancels() {
      return cancels;
    },
    siege(queue) {
      const w = session.world;
      if (w) emit(commands.siegeToggle(w, session.selected, queue));
    },
    stop() {
      emit(commands.stop(session.selected));
    },
  };
}
