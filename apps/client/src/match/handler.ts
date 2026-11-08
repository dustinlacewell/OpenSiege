import type { MatchMsg } from "@mf/protocol";
import { createSimState, decodeWorld, mapSize, type World } from "@mf/sim";
import { setCameraMap, type Camera } from "../game/camera.ts";
import { Lockstep, type LockstepDeps, type Turn } from "../game/lockstep.ts";
import type { Session } from "../game/session.ts";

/** The screen changes a match asks for. `start.ts` binds them to the UI. */
export interface ScreenEvents {
  match(): void;
  ended(winners: string[]): void;
}

export interface HandlerDeps {
  lockstep: LockstepDeps;
  screens: ScreenEvents;
  /** The player's camera: bound to each match world's map on arrival. */
  cam: Camera;
  now(): number;
  /** Called on desync or a turn out of sequence: the host starts over. */
  restart(): void;
}

/** Applies one match message to the session and the screens. */
export function handleMatch(msg: MatchMsg, session: Session, deps: HandlerDeps): void {
  switch (msg.t) {
    case "welcome":
      return startMatch(msg.you, decodeWorld(msg.world), session, deps);
    case "turn":
      return receiveTurn(msg, session, deps);
    case "ended":
      return deps.screens.ended(msg.winners);
    case "desync":
      return desync(session, deps);
  }
}

function startMatch(you: number, world: World, session: Session, deps: HandlerDeps): void {
  const sim = createSimState(world);
  setCameraMap(deps.cam, mapSize(sim.world.terrain));
  session.start(you, new Lockstep(sim, deps.lockstep, deps.now()));
  deps.screens.match();
}

/** A turn out of sequence would freeze the world for good, so it is a desync. */
function receiveTurn(turn: Turn,session: Session, deps: HandlerDeps): void {
  const ls = session.lockstep;
  if (!ls) return;
  const expected = ls.expected;
  if (ls.receive(turn, deps.now())) return;
  console.warn(`turn out of sequence: expected ${expected}, got ${turn.tick}`);
  desync(session, deps);
}

function desync(session: Session, deps: HandlerDeps): void {
  session.stop();
  deps.restart();
}
