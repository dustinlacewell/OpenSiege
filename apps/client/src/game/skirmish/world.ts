// A skirmish's starting world: the map with every seat joined. Pure: the seed is an argument.
// Seating follows the online game: bots pick their start spots in seat order, then the human's spot
// (clicked, or from the seed) moves any bot that stands too close, and every seat joins in one turn.
import { botStartSpot, createBot, type Spot, type TakenSpot } from "@mf/ai";
import { createSimState, createWorld, step, type MapSpec, type Stamped, type World } from "@mf/sim";
import type { LocalBot } from "../../match/localMatch.ts";
import type { PlacementMark } from "../placement.ts";
import type { SkirmishPlan, SkirmishSeat } from "./plan.ts";
import { planErrors } from "./planErrors.ts";
import { autoSpot, BOT_CLEARANCE, botSeed, clampSpot } from "./spots.ts";

/** The spots chosen so far. `spots[i]` is seat i's spot, null while it has none (the human's, before the pick). */
export interface Seating {
  spots: readonly (Spot | null)[];
  /** One mark per seat that has a spot. */
  marks: PlacementMark[];
}

/** The match: the world after every join, the local player id, the computer players, and every start spot. */
export interface SkirmishStart {
  world: World;
  you: number;
  bots: LocalBot[];
  marks: PlacementMark[];
}

/** The bots' spots, before the human picks. Throws when the plan cannot be played. */
export function skirmishSeats(spec: MapSpec, plan: SkirmishPlan, seed: number): Seating {
  checked(plan);
  return seating(plan, placeBots(spec, plan, seed, plan.seats.map(() => null)));
}

/**
 * Tick 1 of the match. `humanSpot` is the clicked spot (forced into the map); null takes a spot from the seed.
 * A bot within BOT_CLEARANCE of the human's spot picks again. Same arguments, same world. Throws when the plan cannot be played.
 */
export function skirmishWorld(spec: MapSpec, plan: SkirmishPlan, seed: number, humanSpot: Spot | null): SkirmishStart {
  const { spots: botSpots } = skirmishSeats(spec, plan, seed);
  const you = humanIndex(plan);
  const chosen = humanSpot ? clampSpot(spec, humanSpot.x, humanSpot.y) : autoSpot(spec, seed, you);
  const spots = placeBots(spec, plan, seed, botSpots.map((s, i) => (i === you ? chosen : s)));
  const state = createSimState(createWorld(spec));
  step(state, joins(plan, spots));
  return { world: state.world, you: you + 1, bots: botsOf(plan, seed), marks: seating(plan, spots).marks };
}

function checked(plan: SkirmishPlan): void {
  const errors = planErrors(plan);
  if (errors.length > 0) throw new Error(`skirmish plan: ${errors.join("; ")}`);
}

function humanIndex(plan: SkirmishPlan): number {
  return plan.seats.findIndex((s) => s.kind === "human");
}

/**
 * Each bot in seat order keeps its spot unless it has none or the human's spot is within BOT_CLEARANCE of it.
 * Otherwise it picks against every other current spot.
 */
function placeBots(spec: MapSpec, plan: SkirmishPlan, seed: number, from: readonly (Spot | null)[]): (Spot | null)[] {
  const spots = [...from];
  plan.seats.forEach((seat, i) => {
    if (seat.kind !== "bot") return;
    const own = spots[i];
    if (own && !humanNear(plan, spots, own)) return;
    spots[i] = null;
    const s = botStartSpot(spec, taken(plan, spots), { team: seat.team }, seat.difficulty, botSeed(seed, i + 1));
    spots[i] = clampSpot(spec, s.x, s.y);
  });
  return spots;
}

function humanNear(plan: SkirmishPlan, spots: readonly (Spot | null)[], spot: Spot): boolean {
  const s = spots[humanIndex(plan)];
  return !!s && Math.hypot(s.x - spot.x, s.y - spot.y) < BOT_CLEARANCE;
}

/** Every spot chosen so far, with its seat's team. */
function taken(plan: SkirmishPlan, spots: readonly (Spot | null)[]): TakenSpot[] {
  return plan.seats.flatMap((seat, i) => {
    const s = spots[i];
    return s ? [{ x: s.x, y: s.y, team: seat.team }] : [];
  });
}

function seating(plan: SkirmishPlan, spots: readonly (Spot | null)[]): Seating {
  const marks = plan.seats.flatMap((seat, i): PlacementMark[] => {
    const s = spots[i];
    return s ? [{ id: i + 1, x: s.x, y: s.y, name: nameOf(plan, seat), team: seat.team, me: seat.kind === "human" }] : [];
  });
  return { spots, marks };
}

function nameOf(plan: SkirmishPlan, seat: SkirmishSeat): string {
  return seat.kind === "human" ? plan.name : seat.name;
}

/** The human's join first, then the bots', as the online game queues them. */
function joins(plan: SkirmishPlan, spots: readonly (Spot | null)[]): Stamped[] {
  const all = plan.seats.map((seat, i): Stamped => {
    const s = spots[i]!;
    return { player: i + 1, intent: { t: "join", name: nameOf(plan, seat), x: s.x, y: s.y, team: seat.team } };
  });
  return [...all.filter((_, i) => i === humanIndex(plan)), ...all.filter((_, i) => i !== humanIndex(plan))];
}

function botsOf(plan: SkirmishPlan, seed: number): LocalBot[] {
  return plan.seats.flatMap((seat, i): LocalBot[] => {
    if (seat.kind !== "bot") return [];
    const bot = createBot({ difficulty: seat.difficulty, seed: botSeed(seed, i + 1) });
    return [{ player: i + 1, think: (world, me) => bot.think(world, me) }];
  });
}
